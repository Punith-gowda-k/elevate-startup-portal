import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import multer from "multer";
import pg from "pg";
import { validateLogin, validateRegistration } from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const scryptAsync = promisify(scrypt);
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

const allowedOrigins = (
  process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const uploadDir = path.resolve(process.cwd(), "src/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDir),
    filename: (_request, file, callback) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      callback(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// --- Security HTTP headers ---
app.use((_req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-XSS-Protection", "0");
  next();
});

// --- CORS ---
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());

// --- Rate limiting ---
const rateLimit = (maxRequests, windowMs) => {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress;
    const now = Date.now();
    if (!hits.has(key)) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    const entry = hits.get(key);
    if (now > entry.reset) {
      entry.count = 1;
      entry.reset = now + windowMs;
      return next();
    }
    entry.count += 1;
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: "Too many requests. Please slow down.",
      });
    }
    next();
  };
};

app.use("/api/register", rateLimit(20, 15 * 60 * 1000));
app.use("/api/login", rateLimit(10, 15 * 60 * 1000));

// --- CSRF protection ---
const csrfTokenStore = new Map();
let csrfTokenId = 0;

function generateCsrfToken() {
  const token = randomBytes(32).toString("hex");
  const id = csrfTokenId++;
  csrfTokenStore.set(id, token);
  return { token, id };
}

function verifyCsrfToken(id, token) {
  const expected = csrfTokenStore.get(Number(id));
  if (!expected) return false;
  if (expected !== token) return false;
  csrfTokenStore.delete(Number(id));
  return true;
}

function useCsrf() {
  if (!app._csrfEnabled) {
    app._csrfEnabled = true;
    app.use((req, res, next) => {
      const method = req.method.toUpperCase();
      const isSafe = ["GET", "HEAD", "OPTIONS"].includes(method);

      if (isSafe && !req.headers["x-csrf-token"] && !req.cookies["csrf_token"]) {
        const { token, id } = generateCsrfToken();
        res.cookie("csrf_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 3600000,
        });
        res.locals = res.locals || {};
        res.locals.csrfToken = token;
        res.locals.csrfTokenId = id;
      }

      if (!isSafe && req.method !== "OPTIONS") {
        const id = req.headers["x-csrf-token-id"];
        const token = req.headers["x-csrf-token"];
        if (!id || !token || !verifyCsrfToken(Number(id), token)) {
          return res.status(403).json({ error: "CSRF validation failed." });
        }
      }
      next();
    });
  }
}

useCsrf();

// --- Password hashing ---
function hashPassword(password, salt) {
  return scryptAsync(password, salt, 64, { N: 131072, r: 8, p: 1 }).then(
    (derivedKey) => derivedKey.toString("hex"),
  );
}

function publicUser(user) {
  return {
    id: user.id,
    startupName: user.startup_name,
    founderName: user.founder_name,
    email: user.email,
    phone: user.phone,
    cin: user.cin,
  };
}

// --- Routes ---

app.post("/api/register", async (request, response) => {
  const validation = validateRegistration(request.body);
  if (!validation.valid) {
    return response.status(400).json({ error: validation.message });
  }

  const { password, ...account } = request.body;
  const salt = randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);

  try {
    const result = await pool.query(
      `INSERT INTO users (startup_name, founder_name, email, phone, cin, password_hash, password_salt)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, startup_name, founder_name, email, phone, cin, created_at`,
      [
        account.startupName.trim(),
        account.founderName.trim(),
        account.email.trim().toLowerCase(),
        account.phone.trim(),
        account.cin.trim() ? account.cin.trim().toUpperCase() : null,
        passwordHash,
        salt,
      ],
    );
    return response.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === "23505") {
      return response
        .status(409)
        .json({ error: "An account with this email already exists." });
    }
    console.error(error);
    return response
      .status(500)
      .json({ error: "Unable to create the account." });
  }
});

let loginAttempts = new Map();

app.post("/api/login", async (request, response) => {
  const validation = validateLogin(request.body);
  if (!validation.valid) {
    return response.status(400).json({ error: validation.message });
  }

  const email = String(request.body.email).trim().toLowerCase();
  const password = String(request.body.password);

  const ip =
    req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress;

  const key = "login:" + ip + ":" + email;
  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, {
      count: 0,
      unlockTime: Date.now() + 15 * 60 * 1000,
    });
  }
  const attempt = loginAttempts.get(key);
  if (attempt.count >= 5) {
    const remaining = Math.ceil((attempt.unlockTime - Date.now()) / 1000);
    return response.status(429).json({
      error:
        "Account temporarily locked. Try again in " + remaining + " seconds.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, startup_name, founder_name, email, phone, cin, password_hash, password_salt
       FROM users WHERE email = $1`,
      [email],
    );
    const user = result.rows[0];
    if (!user) {
      loginAttempts.set(key, { count: attempt.count + 1 });
      return response
        .status(401)
        .json({ error: "Invalid email address or password." });
    }

    const passwordHash = await hashPassword(password, user.password_salt);
    if (passwordHash !== user.password_hash) {
      loginAttempts.set(key, { count: attempt.count + 1 });
      return response
        .status(401)
        .json({ error: "Invalid email address or password." });
    }

    // Reset failed attempts on successful login
    loginAttempts.delete(key);
    return response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to authenticate the user." });
  }
});

app.get("/api/transactions/:userId", async (request, response) => {
  try {
    const result = await pool.query(
      `SELECT id, date, type, description, amount, status, proof_file_name, proof_mime_type, proof_size, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [request.params.userId],
    );
    return response.json({ transactions: result.rows });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load transactions." });
  }
});

app.post(
  "/api/transactions",
  upload.single("proof"),
  async (request, response) => {
    const { userId, date, type, description, amount } = request.body;
    const numericAmount = Number(amount);
    const proofFile = request.file;

    if (
      !userId ||
      !date ||
      !["Utilization", "Fund Disbursement"].includes(type) ||
      !description ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return response
        .status(400)
        .json({ error: "Invalid transaction details." });
    }

    if (proofFile && proofFile.size > 10 * 1024 * 1024) {
      return response
        .status(400)
        .json({ error: "Proof document must be 10 MB or smaller." });
    }

    try {
      const result = await pool.query(
        `INSERT INTO transactions (user_id, date, type, description, amount, proof_file_name, proof_mime_type, proof_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, date, type, description, amount, status, proof_file_name, proof_mime_type, proof_size, created_at`,
        [
          userId,
          date,
          type,
          description.trim(),
          Number(amount),
          proofFile ? proofFile.filename : null,
          proofFile ? proofFile.mimetype : null,
          proofFile ? proofFile.size : null,
        ],
      );
      return response.status(201).json({ transaction: result.rows[0] });
    } catch (error) {
      console.error(error);
      return response
        .status(500)
        .json({ error: "Unable to add the transaction." });
    }
  },
);

app.get("/api/health", (_request, response) =>
  response.json({ status: "ok" }),
);

app.listen(port, () => {
  console.log(
    "Karnataka startup portal API listening on http://localhost:" + port,
  );
});


// --- CSRF token endpoint ---

app.get('/api/csrf-token', (request, response) => {
  const { token, id } = generateCsrfToken();
  response.json({ csrfToken: token, csrfTokenId: id });
});

