import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import multer from "multer";
import pg from "pg";
import { validateLogin, validateRegistration } from "../shared/validation.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const scryptAsync = promisify(scrypt);
const { Pool } = pg;
const gmSessions = new Map();
const GM_SESSION_DURATION = 60 * 60 * 1000;

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

const uploadDir = path.resolve(process.cwd(), "backend/uploads");
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());

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

function hashPassword(password, salt) {
  return scryptAsync(password, salt, 64).then((derivedKey) =>
    derivedKey.toString("hex"),
  );
}

function requireGM(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const session = token && gmSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) gmSessions.delete(token);
    return response.status(401).json({ error: "GM session expired." });
  }
  session.expiresAt = Date.now() + GM_SESSION_DURATION;
  request.gm = session;
  next();
}

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

app.post("/api/login", async (request, response) => {
  const validation = validateLogin(request.body);
  if (!validation.valid) {
    return response.status(400).json({ error: validation.message });
  }
  const email = String(request.body.email).trim().toLowerCase();
  const password = String(request.body.password);

  try {
    const result = await pool.query(
      `SELECT id, startup_name, founder_name, email, phone, cin, password_hash, password_salt
       FROM users WHERE email = $1`,
      [email],
    );
    const user = result.rows[0];
    if (!user) {
      return response
        .status(401)
        .json({ error: "Invalid email address or password." });
    }

    const passwordHash = await hashPassword(password, user.password_salt);
    if (passwordHash !== user.password_hash) {
      return response
        .status(401)
        .json({ error: "Invalid email address or password." });
    }

    return response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return response
      .status(500)
      .json({ error: "Unable to authenticate the user." });
  }
});

app.post("/api/gm/login", async (request, response) => {
  const expectedEmail = process.env.GM_EMAIL || "gm@gmail.com";
  const expectedPassword = process.env.GM_PASSWORD || "Demo@123";
  const email = String(request.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(request.body.password || "");

  if (email !== expectedEmail || password !== expectedPassword) {
    return response.status(401).json({ error: "Invalid GM credentials." });
  }

  const token = randomBytes(32).toString("hex");
  gmSessions.set(token, { expiresAt: Date.now() + GM_SESSION_DURATION });
  return response.json({
    admin: {
      id: "gm-admin",
      email: expectedEmail,
      role: "Government Manager",
    },
    token,
  });
});

app.get("/api/gm/startups", requireGM, async (_request, response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.startup_name, u.founder_name, u.email, u.phone, u.cin,
              e.registration_state, e.entity_type, e.turnover, e.incorporation_date,
              e.innovation_idea, e.status AS eligibility_status, e.verified_at, e.rejected_at,
              COUNT(t.id) AS transaction_count,
              COALESCE(SUM(CASE WHEN t.type = 'Fund Disbursement' THEN t.amount ELSE 0 END), 0) AS fund_disbursed,
              COALESCE(SUM(CASE WHEN t.type = 'Utilization' THEN t.amount ELSE 0 END), 0) AS utilization_total,
              MAX(t.created_at) AS last_activity_at
       FROM users u
       LEFT JOIN eligibility e ON e.user_id = u.id
       LEFT JOIN transactions t ON t.user_id = u.id
       GROUP BY u.id, u.startup_name, u.founder_name, u.email, u.phone, u.cin,
                e.registration_state, e.entity_type, e.turnover, e.incorporation_date,
                e.innovation_idea, e.status, e.verified_at, e.rejected_at
       ORDER BY COALESCE(MAX(t.created_at), u.created_at) DESC`,
    );

    const startups = result.rows.map((row) => {
      const rawStatus = row.eligibility_status || "Pending";
      const gmReviewStatus =
        rawStatus === "Verified"
          ? "Verified"
          : rawStatus === "Rejected"
            ? "Rejected"
            : "Pending GM Review";
      const isPending = rawStatus === "Pending" || rawStatus === "Pending GM Review";

      return {
        id: row.id,
        startupName: row.startup_name,
        founderName: row.founder_name,
        email: row.email,
        phone: row.phone,
        cin: row.cin,
        registrationState: row.registration_state,
        entityType: row.entity_type,
        turnover: Number(row.turnover),
        incorporationDate: row.incorporation_date,
        innovationIdea: row.innovation_idea,
        eligibilityStatus: rawStatus,
        gmReviewStatus,
        isPending,
        isVerified: rawStatus === "Verified",
        isRejected: rawStatus === "Rejected",
        verifiedAt: row.verified_at,
        rejectedAt: row.rejected_at,
        transactionCount: Number(row.transaction_count),
        fundDisbursed: Number(row.fund_disbursed),
        utilizationTotal: Number(row.utilization_total),
        lastActivityAt: row.last_activity_at,
      };
    });

    return response.json({ startups });
  } catch (error) {
    console.error(error);
    return response
      .status(500)
      .json({ error: "Unable to load startup activity." });
  }
});

app.get("/api/gm/transactions", requireGM, async (_request, response) => {
  try {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.startup_name, u.founder_name, u.email,
              t.id, t.date, t.type, t.description, t.amount, t.status,
              t.proof_file_name, t.proof_mime_type, t.proof_size, t.created_at
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC, t.id DESC`,
    );
    return response.json({
      transactions: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        startupName: row.startup_name,
        founderName: row.founder_name,
        email: row.email,
        date: row.date,
        type: row.type,
        description: row.description,
        amount: Number(row.amount),
        status: row.status,
        proofFileName: row.proof_file_name,
        proofMimeType: row.proof_mime_type,
        proofSize: row.proof_size,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error(error);
    return response
      .status(500)
      .json({ error: "Unable to load startup transactions." });
  }
});

app.get("/api/gm/startups/:userId", requireGM, async (request, response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.startup_name, u.founder_name, u.email, u.phone, u.cin,
              e.registration_state, e.entity_type, e.turnover, e.incorporation_date,
              e.innovation_idea, e.status AS eligibility_status, e.verified_at, e.rejected_at,
              t.id AS transaction_id, t.date, t.type, t.description, t.amount, t.status AS transaction_status,
              t.proof_file_name, t.proof_mime_type, t.proof_size, t.created_at AS transaction_created_at
       FROM users u
       LEFT JOIN eligibility e ON e.user_id = u.id
       LEFT JOIN transactions t ON t.user_id = u.id
       WHERE u.id = $1
       ORDER BY t.created_at DESC, t.id DESC`,
      [request.params.userId],
    );
    const rows = result.rows;
    if (!rows.length) {
      return response.status(404).json({ error: "Startup not found." });
    }

    const rawStatus = rows[0].eligibility_status || "Pending";
    const gmReviewStatus =
      rawStatus === "Verified"
        ? "Verified"
        : rawStatus === "Rejected"
          ? "Rejected"
          : "Pending GM Review";
    const isPending = rawStatus === "Pending" || rawStatus === "Pending GM Review";

    const startup = {
      ...publicUser(rows[0]),
      eligibility: {
        registrationState: rows[0].registration_state,
        entityType: rows[0].entity_type,
        turnover: Number(rows[0].turnover),
        incorporationDate: rows[0].incorporation_date,
        innovationIdea: rows[0].innovation_idea,
        status: rows[0].eligibility_status,
        verifiedAt: rows[0].verified_at,
        rejectedAt: rows[0].rejected_at,
      },
      gmReviewStatus,
      isPending,
      isVerified: rawStatus === "Verified",
      isRejected: rawStatus === "Rejected",
      transactions: rows
        .filter((row) => row.transaction_id)
        .map((row) => ({
          id: row.transaction_id,
          date: row.date,
          type: row.type,
          description: row.description,
          amount: Number(row.amount),
          status: row.transaction_status,
          proofFileName: row.proof_file_name,
          proofMimeType: row.proof_mime_type,
          proofSize: row.proof_size,
          createdAt: row.transaction_created_at,
        })),
    };
    return response.json({ startup });
  } catch (error) {
    console.error(error);
    return response
      .status(500)
      .json({ error: "Unable to load startup details." });
  }
});

app.get("/api/eligibility/:userId", async (request, response) => {
  try {
    const result = await pool.query(
      `SELECT registration_state, entity_type, turnover, incorporation_date,
              innovation_idea, status, verified_at
       FROM eligibility
       WHERE user_id = $1`,
      [request.params.userId],
    );
    return response.json({ eligibility: result.rows[0] || null });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load eligibility." });
  }
});

app.post("/api/eligibility", async (request, response) => {
  const {
    userId,
    registrationState,
    entityType,
    turnover,
    incorporationDate,
    innovationIdea,
  } = request.body;
  const numericTurnover = Number(turnover);
  const innovationLength = String(innovationIdea || "").trim().length;
  const failedReasons = [];

  if (!userId) {
    return response.status(400).json({ error: "Startup account is required." });
  }
  if (registrationState !== "Karnataka") {
    failedReasons.push("State of company registration must be Karnataka.");
  }
  if (
    !["Private Limited", "OPC", "LLP", "Partnership", "Other"].includes(
      entityType,
    )
  ) {
    failedReasons.push("The entity type is invalid.");
  }
  if (!Number.isFinite(numericTurnover) || numericTurnover < 0) {
    failedReasons.push("Current turnover must be a valid non-negative amount.");
  } else if (numericTurnover >= 1000000000) {
    failedReasons.push("Current turnover must be below ₹100 crore.");
  }

  const incorporationMatch = /^\d{4}-\d{2}-\d{2}$/.test(
    incorporationDate || "",
  );
  let incorporationDateValue = null;
  if (incorporationMatch) {
    incorporationDateValue = new Date(`${incorporationDate}T00:00:00Z`);
    if (!Number.isNaN(incorporationDateValue.getTime())) {
      const tenYearsAgo = new Date();
      tenYearsAgo.setUTCFullYear(tenYearsAgo.getUTCFullYear() - 10);
      if (
        incorporationDateValue > new Date() ||
        incorporationDateValue < tenYearsAgo
      ) {
        failedReasons.push(
          "Date of incorporation must be within the last 10 years.",
        );
      }
    } else {
      failedReasons.push("Date of incorporation must be a valid date.");
    }
  } else {
    failedReasons.push("Date of incorporation must be a valid date.");
  }

  if (innovationLength < 20 || innovationLength > 5000) {
    failedReasons.push(
      "Describe your innovation idea in 20 to 5,000 characters.",
    );
  }

  // Submitting eligibility always creates/refreshes a "Pending" record that
  // waits for the Government Manager to approve or reject it. The automatic
  // checks above are still reported back so the founder can see any issues,
  // but they never grant "Verified" status on their own.
  const eligible = failedReasons.length === 0;
  const status = "Pending";

  try {
    const result = await pool.query(
      `INSERT INTO eligibility (
         user_id, registration_state, entity_type, turnover,
         incorporation_date, innovation_idea, status, verified_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE
       SET registration_state = EXCLUDED.registration_state,
           entity_type = EXCLUDED.entity_type,
           turnover = EXCLUDED.turnover,
           incorporation_date = EXCLUDED.incorporation_date,
           innovation_idea = EXCLUDED.innovation_idea,
           status = EXCLUDED.status,
           verified_at = CASE WHEN EXCLUDED.status = 'Verified' THEN CURRENT_TIMESTAMP ELSE eligibility.verified_at END,
           updated_at = CURRENT_TIMESTAMP
       RETURNING registration_state, entity_type, turnover, incorporation_date,
                 innovation_idea, status, verified_at`,
      [
        userId,
        registrationState,
        entityType,
        numericTurnover,
        incorporationDate,
        innovationIdea.trim(),
        status,
        null,
      ],
    );
    return response.status(200).json({
      eligibility: result.rows[0],
      eligible,
      failedReasons,
    });
  } catch (error) {
    console.error(error);
    return response
      .status(500)
      .json({ error: "Unable to verify eligibility." });
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

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

app.post(
  "/api/gm/startups/:userId/approve",
  requireGM,
  async (request, response) => {
    const userId = request.params.userId;

    if (!userId) {
      return response.status(400).json({ error: "Startup account is required." });
    }

    try {
      const result = await pool.query(
        `UPDATE eligibility
         SET status = 'Verified', verified_at = CURRENT_TIMESTAMP, rejected_at = NULL
         WHERE user_id = $1
         RETURNING status, verified_at, rejected_at`,
        [userId],
      );

      if (!result.rows.length) {
        return response.status(404).json({ error: "Startup or eligibility record not found." });
      }

      return response.json({
        success: true,
        eligibility: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      return response
        .status(500)
        .json({ error: "Unable to approve the startup." });
    }
  },
);

app.post(
  "/api/gm/startups/:userId/reject",
  requireGM,
  async (request, response) => {
    const userId = request.params.userId;

    if (!userId) {
      return response.status(400).json({ error: "Startup account is required." });
    }

    try {
      const result = await pool.query(
        `UPDATE eligibility
         SET status = 'Rejected', rejected_at = CURRENT_TIMESTAMP, verified_at = NULL
         WHERE user_id = $1
         RETURNING status, verified_at, rejected_at`,
        [userId],
      );

      if (!result.rows.length) {
        return response.status(404).json({ error: "Startup or eligibility record not found." });
      }

      return response.json({
        success: true,
        eligibility: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      return response
        .status(500)
        .json({ error: "Unable to reject the startup." });
    }
  },
);

app.patch(
  "/api/eligibility/:userId",
  requireGM,
  async (request, response) => {
    const userId = request.params.userId;
    const { status, verifiedAt, rejectedAt } = request.body;

    if (!userId) {
      return response.status(400).json({ error: "Startup account is required." });
    }

    const allowedStatuses = ["Verified", "Pending", "Rejected"];
    if (!status || !allowedStatuses.includes(status)) {
      return response.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(", ")}.` });
    }

    try {
      const result = await pool.query(
        `UPDATE eligibility
         SET status = $1,
             verified_at = CASE WHEN $2::timestamptz IS NOT NULL THEN $2::timestamptz ELSE verified_at END,
             rejected_at = CASE WHEN $3::timestamptz IS NOT NULL THEN $3::timestamptz ELSE rejected_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4
         RETURNING status, verified_at, rejected_at`,
        [status, verifiedAt, rejectedAt, userId],
      );

      if (!result.rows.length) {
        return response.status(404).json({ error: "Startup or eligibility record not found." });
      }

      return response.json({
        success: true,
        eligibility: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      return response
        .status(500)
        .json({ error: "Unable to update the eligibility status." });
    }
  },
);

app.listen(port, () => {
  console.log(
    `Karnataka startup portal API listening on http://localhost:${port}`,
  );
});
