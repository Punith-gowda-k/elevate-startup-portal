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

// ============================================================
//  Admin Portal infrastructure
// ============================================================
const adminSessions = new Map();
const ADMIN_SESSION_DURATION = 60 * 60 * 1000;

const ADMIN_PERMISSIONS = [
  { code: "users.manage", description: "Create, edit and manage user accounts" },
  { code: "users.activate", description: "Activate or deactivate user accounts" },
  { code: "roles.manage", description: "Assign roles and permissions" },
  { code: "logs.view", description: "Review login and administrative activity logs" },
  { code: "forms.manage", description: "Build and manage dynamic form fields" },
];

// ---- Elevate Winners reference data (editable here, no rebuild needed) ----
const WINNER_SECTORS = [
  "Agritech",
  "Artificial Intelligence / ML",
  "Biotechnology",
  "E-commerce / D2C",
  "EdTech",
  "Fintech",
  "HealthTech / MedTech",
  "IoT / Hardware / Robotics",
  "Renewable Energy / Cleantech",
  "SaaS / Enterprise Software",
  "Space Tech",
  "Other",
];

const KARNATAKA_DISTRICTS = [
  "Bagalkot",
  "Ballari",
  "Belagavi",
  "Bengaluru Rural",
  "Bengaluru Urban",
  "Bidar",
  "Chamarajanagar",
  "Chikkaballapur",
  "Chikkamagaluru",
  "Chitradurga",
  "Dakshina Kannada",
  "Davanagere",
  "Dharwad",
  "Gadag",
  "Hassan",
  "Haveri",
  "Kalaburagi",
  "Kodagu",
  "Kolar",
  "Koppal",
  "Mandya",
  "Mysuru",
  "Raichur",
  "Ramanagara",
  "Shivamogga",
  "Tumakuru",
  "Udupi",
  "Uttara Kannada",
  "Vijayapura",
  "Vijayanagara",
  "Yadgir",
];

// Ensures the Elevate Winners table exists (auto-created on startup).
async function ensureWinnersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS winners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      winning_year INT NOT NULL,
      company_name VARCHAR(160) NOT NULL,
      founder_name VARCHAR(120),
      mobile_number VARCHAR(20),
      sector VARCHAR(80) NOT NULL,
      district VARCHAR(80) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE winners ADD COLUMN IF NOT EXISTS founder_name VARCHAR(120);
    ALTER TABLE winners ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);
    CREATE INDEX IF NOT EXISTS winners_year_idx ON winners (winning_year DESC);
  `);
}

function clientIp(request) {
  return (
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.socket?.remoteAddress ||
    null
  );
}

async function recordActivity({
  actorType,
  actorId = null,
  actorEmail = null,
  action,
  targetType = null,
  targetId = null,
  details = null,
  request = null,
}) {
  try {
    await pool.query(
      `INSERT INTO activity_logs
         (actor_type, actor_id, actor_email, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actorType,
        actorId,
        actorEmail,
        action,
        targetType,
        targetId,
        details,
        request ? clientIp(request) : null,
      ],
    );
  } catch (error) {
    // Never let audit logging break the main request flow.
    console.error("Failed to record activity log:", error.message);
  }
}

function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const session = token && adminSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) adminSessions.delete(token);
    return response.status(401).json({ error: "Admin session expired." });
  }
  session.expiresAt = Date.now() + ADMIN_SESSION_DURATION;
  request.admin = session;
  next();
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    roleId: admin.role_id,
    roleName: admin.role_name || null,
  };
}

function publicAdminUser(row) {
  return {
    id: row.id,
    startupName: row.startup_name,
    founderName: row.founder_name,
    email: row.email,
    phone: row.phone,
    cin: row.cin,
    roleId: row.role_id,
    roleName: row.role_name || "founder",
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

// Seeds roles, permissions and a default admin account on startup.
// Safe to run repeatedly (idempotent).
async function seedAdminData() {
  // Permissions
  for (const permission of ADMIN_PERMISSIONS) {
    await pool.query(
      `INSERT INTO permissions (code, description) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [permission.code, permission.description],
    );
  }

  // Roles
  const roleDefinitions = [
    { name: "admin", description: "Full administrative access to the portal" },
    { name: "gm", description: "Government Manager — reviews startups" },
    { name: "founder", description: "Registered startup founder" },
  ];
  const roleIds = {};
  for (const role of roleDefinitions) {
    const { rows } = await pool.query(
      `INSERT INTO roles (name, description) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
       RETURNING id, name`,
      [role.name, role.description],
    );
    roleIds[role.name] = rows[0].id;
  }

  // Admin role gets every permission.
  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT $1, p.id FROM permissions p
     ON CONFLICT DO NOTHING`,
    [roleIds.admin],
  );

  // Default admin account (credentials from env, with safe fallbacks).
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@gmail.com")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Demo@123";
  const adminName = process.env.ADMIN_NAME || "Portal Administrator";

  const existing = await pool.query(`SELECT id FROM admins WHERE email = $1`, [
    adminEmail,
  ]);
  if (!existing.rows.length) {
    const salt = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(adminPassword, salt);
    await pool.query(
      `INSERT INTO admins (name, email, password_hash, password_salt, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminName, adminEmail, passwordHash, salt, roleIds.admin],
    );
    console.log(`Seeded default admin account: ${adminEmail}`);
  }
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

// Unified staff login: authenticates EITHER an Admin (admins table) OR the
// Government Manager (environment credentials) from one form, and returns
// which role signed in so the client can open the right workspace.
app.post("/api/staff/login", async (request, response) => {
  const email = String(request.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(request.body.password || "");
  if (!email || !password) {
    return response.status(400).json({ error: "Email and password are required." });
  }

  // 1) Try the admins table (Admin portal).
  try {
    const adminResult = await pool.query(
      `SELECT a.id, a.name, a.email, a.password_hash, a.password_salt, a.is_active,
              a.role_id, r.name AS role_name
         FROM admins a
         LEFT JOIN roles r ON r.id = a.role_id
        WHERE a.email = $1`,
      [email],
    );
    const admin = adminResult.rows[0];
    if (admin && admin.is_active) {
      const passwordHash = await hashPassword(password, admin.password_salt);
      if (passwordHash === admin.password_hash) {
        const token = randomBytes(32).toString("hex");
        adminSessions.set(token, {
          adminId: admin.id,
          email: admin.email,
          expiresAt: Date.now() + ADMIN_SESSION_DURATION,
        });
        await pool.query(
          `UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [admin.id],
        );
        await recordActivity({
          actorType: "admin",
          actorId: admin.id,
          actorEmail: admin.email,
          action: "admin.login",
          request,
        });
        return response.json({ role: "admin", admin: publicAdmin(admin), token });
      }
    }
  } catch (error) {
    console.error("Staff login (admin) failed:", error);
  }

  // 2) Try the Government Manager (environment credentials).
  const expectedEmail = process.env.GM_EMAIL || "gm@gmail.com";
  const expectedPassword = process.env.GM_PASSWORD || "Demo@123";
  if (email === expectedEmail && password === expectedPassword) {
    const token = randomBytes(32).toString("hex");
    gmSessions.set(token, { expiresAt: Date.now() + GM_SESSION_DURATION });
    await recordActivity({
      actorType: "gm",
      actorEmail: expectedEmail,
      action: "gm.login",
      request,
    });
    return response.json({
      role: "gm",
      admin: { id: "gm-admin", email: expectedEmail, role: "Government Manager" },
      token,
    });
  }

  await recordActivity({
    actorType: "system",
    actorEmail: email,
    action: "staff.login_failed",
    request,
  });
  return response.status(401).json({ error: "Invalid email or password." });
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

// ============================================================
//  Admin Portal routes
// ============================================================

// ---- Admin authentication ----
app.post("/api/admin/login", async (request, response) => {
  const email = String(request.body.email || "").trim().toLowerCase();
  const password = String(request.body.password || "");
  if (!email || !password) {
    return response.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await pool.query(
      `SELECT a.id, a.name, a.email, a.password_hash, a.password_salt, a.is_active,
              a.role_id, r.name AS role_name
         FROM admins a
         LEFT JOIN roles r ON r.id = a.role_id
        WHERE a.email = $1`,
      [email],
    );
    const admin = result.rows[0];
    if (!admin || !admin.is_active) {
      await recordActivity({
        actorType: "system",
        actorEmail: email,
        action: "admin.login_failed",
        request,
      });
      return response.status(401).json({ error: "Invalid admin credentials." });
    }

    const passwordHash = await hashPassword(password, admin.password_salt);
    if (passwordHash !== admin.password_hash) {
      await recordActivity({
        actorType: "admin",
        actorId: admin.id,
        actorEmail: admin.email,
        action: "admin.login_failed",
        request,
      });
      return response.status(401).json({ error: "Invalid admin credentials." });
    }

    const token = randomBytes(32).toString("hex");
    adminSessions.set(token, {
      adminId: admin.id,
      email: admin.email,
      expiresAt: Date.now() + ADMIN_SESSION_DURATION,
    });
    await pool.query(`UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      admin.id,
    ]);
    await recordActivity({
      actorType: "admin",
      actorId: admin.id,
      actorEmail: admin.email,
      action: "admin.login",
      request,
    });

    return response.json({
      admin: publicAdmin(admin),
      token,
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to authenticate the admin." });
  }
});

// ---- Users & role management ----
app.get("/api/admin/users", requireAdmin, async (_request, response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.startup_name, u.founder_name, u.email, u.phone, u.cin,
              u.role_id, r.name AS role_name, u.is_active, u.last_login_at, u.created_at
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        ORDER BY u.created_at DESC`,
    );
    return response.json({ users: result.rows.map(publicAdminUser) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load users." });
  }
});

app.delete("/api/admin/users/:userId", requireAdmin, async (request, response) => {
  const userId = request.params.userId;
  try {
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, startup_name`,
      [userId],
    );
    if (!result.rows.length) {
      return response.status(404).json({ error: "User not found." });
    }
    await recordActivity({
      actorType: "admin",
      actorId: request.admin.adminId,
      actorEmail: request.admin.email,
      action: "user.deleted",
      targetType: "user",
      targetId: userId,
      details: result.rows[0].startup_name,
      request,
    });
    return response.json({ success: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to delete the user." });
  }
});

app.post("/api/admin/users", requireAdmin, async (request, response) => {
  const {
    startupName,
    founderName,
    email,
    phone,
    cin,
    password,
    roleName = "founder",
  } = request.body;

  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  const cleanName = String(startupName || "").trim();
  const cleanFounder = String(founderName || "").trim();
  const cleanPhone = String(phone || "").trim();

  if (
    !cleanName ||
    !cleanFounder ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanPassword.length < 8 ||
    !/[A-Z]/.test(cleanPassword) ||
    !/[^A-Za-z0-9]/.test(cleanPassword)
  ) {
    return response.status(400).json({
      error:
        "Provide a startup name, founder name, valid email and a password (8+ chars, one uppercase, one special character).",
    });
  }

  try {
    const roleResult = await pool.query(`SELECT id FROM roles WHERE name = $1`, [
      String(roleName || "founder"),
    ]);
    const roleId = roleResult.rows[0]?.id || null;

    const salt = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(cleanPassword, salt);

    const result = await pool.query(
      `INSERT INTO users (startup_name, founder_name, email, phone, cin, password_hash, password_salt, role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, startup_name, founder_name, email, phone, cin, role_id, is_active, last_login_at, created_at`,
      [
        cleanName,
        cleanFounder,
        cleanEmail,
        cleanPhone,
        cin ? String(cin).trim().toUpperCase() : null,
        passwordHash,
        salt,
        roleId,
      ],
    );

    await recordActivity({
      actorType: "admin",
      actorId: request.admin.adminId,
      actorEmail: request.admin.email,
      action: "user.created",
      targetType: "user",
      targetId: result.rows[0].id,
      details: `${cleanEmail} (role: ${roleName})`,
      request,
    });

    const withRole = await pool.query(
      `SELECT u.id, u.startup_name, u.founder_name, u.email, u.phone, u.cin,
              u.role_id, r.name AS role_name, u.is_active, u.last_login_at, u.created_at
         FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [result.rows[0].id],
    );
    return response.status(201).json({ user: publicAdminUser(withRole.rows[0]) });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({ error: "An account with this email already exists." });
    }
    console.error(error);
    return response.status(500).json({ error: "Unable to create the user." });
  }
});

app.patch("/api/admin/users/:userId", requireAdmin, async (request, response) => {
  const userId = request.params.userId;
  const { roleName, founderName, phone, cin } = request.body;

  try {
    let roleId;
    if (roleName !== undefined) {
      const roleResult = await pool.query(`SELECT id FROM roles WHERE name = $1`, [
        String(roleName),
      ]);
      roleId = roleResult.rows[0]?.id || null;
      if (!roleId) {
        return response.status(400).json({ error: "Invalid role." });
      }
    }

    const result = await pool.query(
      `UPDATE users
          SET role_id = COALESCE($1, role_id),
              founder_name = COALESCE($2, founder_name),
              phone = COALESCE($3, phone),
              cin = COALESCE($4, cin)
        WHERE id = $5
        RETURNING id, startup_name, founder_name, email, phone, cin, role_id, is_active, last_login_at, created_at`,
      [
        roleId || null,
        founderName ? String(founderName).trim() : null,
        phone ? String(phone).trim() : null,
        cin ? String(cin).trim().toUpperCase() : null,
        userId,
      ],
    );
    if (!result.rows.length) {
      return response.status(404).json({ error: "User not found." });
    }

    await recordActivity({
      actorType: "admin",
      actorId: request.admin.adminId,
      actorEmail: request.admin.email,
      action: "user.updated",
      targetType: "user",
      targetId: userId,
      details: roleName ? `role set to ${roleName}` : null,
      request,
    });

    const withRole = await pool.query(
      `SELECT u.id, u.startup_name, u.founder_name, u.email, u.phone, u.cin,
              u.role_id, r.name AS role_name, u.is_active, u.last_login_at, u.created_at
         FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId],
    );
    return response.json({ user: publicAdminUser(withRole.rows[0]) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to update the user." });
  }
});

app.patch(
  "/api/admin/users/:userId/status",
  requireAdmin,
  async (request, response) => {
    const userId = request.params.userId;
    const isActive = Boolean(request.body.isActive);

    try {
      const result = await pool.query(
        `UPDATE users SET is_active = $1 WHERE id = $2
         RETURNING id, startup_name, founder_name, email, phone, cin, role_id, is_active, last_login_at, created_at`,
        [isActive, userId],
      );
      if (!result.rows.length) {
        return response.status(404).json({ error: "User not found." });
      }

      await recordActivity({
        actorType: "admin",
        actorId: request.admin.adminId,
        actorEmail: request.admin.email,
        action: isActive ? "account.activated" : "account.deactivated",
        targetType: "user",
        targetId: userId,
        request,
      });

      const withRole = await pool.query(
        `SELECT u.id, u.startup_name, u.founder_name, u.email, u.phone, u.cin,
                u.role_id, r.name AS role_name, u.is_active, u.last_login_at, u.created_at
           FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
        [userId],
      );
      return response.json({ user: publicAdminUser(withRole.rows[0]) });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Unable to update account status." });
    }
  },
);

// ---- Roles & permissions ----
app.get("/api/admin/roles", requireAdmin, async (_request, response) => {
  try {
    const rolesResult = await pool.query(
      `SELECT r.id, r.name, r.description,
              COALESCE(
                ARRAY_AGG(p.code) FILTER (WHERE p.code IS NOT NULL),
                ARRAY[]::text[]
              ) AS permissions
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN permissions p ON p.id = rp.permission_id
        GROUP BY r.id, r.name, r.description
        ORDER BY r.name`,
    );
    return response.json({ roles: rolesResult.rows });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load roles." });
  }
});

app.get("/api/admin/permissions", requireAdmin, async (_request, response) => {
  try {
    const result = await pool.query(
      `SELECT id, code, description FROM permissions ORDER BY code`,
    );
    return response.json({ permissions: result.rows });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load permissions." });
  }
});

app.put(
  "/api/admin/roles/:roleId/permissions",
  requireAdmin,
  async (request, response) => {
    const roleId = request.params.roleId;
    const codes = Array.isArray(request.body.permissionCodes)
      ? request.body.permissionCodes
      : [];

    try {
      const role = await pool.query(`SELECT id, name FROM roles WHERE id = $1`, [
        roleId,
      ]);
      if (!role.rows.length) {
        return response.status(404).json({ error: "Role not found." });
      }

      await pool.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
      for (const code of codes) {
        await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE code = $2
           ON CONFLICT DO NOTHING`,
          [roleId, code],
        );
      }

      await recordActivity({
        actorType: "admin",
        actorId: request.admin.adminId,
        actorEmail: request.admin.email,
        action: "role.permissions_updated",
        targetType: "role",
        targetId: roleId,
        details: `${role.rows[0].name}: ${codes.join(", ") || "none"}`,
        request,
      });

      const updated = await pool.query(
        `SELECT r.id, r.name, r.description,
                COALESCE(
                  ARRAY_AGG(p.code) FILTER (WHERE p.code IS NOT NULL),
                  ARRAY[]::text[]
                ) AS permissions
           FROM roles r
           LEFT JOIN role_permissions rp ON rp.role_id = r.id
           LEFT JOIN permissions p ON p.id = rp.permission_id
          WHERE r.id = $1
          GROUP BY r.id, r.name, r.description`,
        [roleId],
      );
      return response.json({ role: updated.rows[0] });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Unable to update role permissions." });
    }
  },
);

// ---- Activity logs ----
app.get("/api/admin/activity-logs", requireAdmin, async (request, response) => {
  const limit = Math.min(Number(request.query.limit) || 200, 500);
  try {
    const result = await pool.query(
      `SELECT id, actor_type, actor_id, actor_email, action, target_type, target_id, details, ip_address, created_at
         FROM activity_logs
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
    );
    return response.json({ logs: result.rows });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load activity logs." });
  }
});

// ---- Dynamic form builder ----
app.get("/api/admin/forms", requireAdmin, async (_request, response) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.form_key, f.name, f.description, f.created_at, f.updated_at,
              COUNT(ff.id)::int AS field_count
         FROM form_definitions f
         LEFT JOIN form_fields ff ON ff.form_id = f.id
        GROUP BY f.id, f.form_key, f.name, f.description, f.created_at, f.updated_at
        ORDER BY f.created_at DESC`,
    );
    return response.json({ forms: result.rows });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load forms." });
  }
});

app.post("/api/admin/forms", requireAdmin, async (request, response) => {
  const formKey = String(request.body.formKey || "").trim();
  const name = String(request.body.name || "").trim();
  const description = String(request.body.description || "").trim() || null;

  if (!/^[a-z0-9_]+$/.test(formKey) || !name) {
    return response.status(400).json({
      error: "Form key (lowercase letters, numbers, underscore) and name are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO form_definitions (form_key, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, form_key, name, description, created_at, updated_at`,
      [formKey, name, description],
    );
    await recordActivity({
      actorType: "admin",
      actorId: request.admin.adminId,
      actorEmail: request.admin.email,
      action: "form.created",
      targetType: "form",
      targetId: result.rows[0].id,
      details: `${formKey} — ${name}`,
      request,
    });
    return response.status(201).json({
      form: { ...result.rows[0], field_count: 0 },
    });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({ error: "A form with this key already exists." });
    }
    console.error(error);
    return response.status(500).json({ error: "Unable to create the form." });
  }
});

app.get(
  "/api/admin/forms/:formId/fields",
  requireAdmin,
  async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT id, form_id, field_name, label, field_type, placeholder, help_text,
                section, is_required, options, sort_order, is_active, created_at, updated_at
           FROM form_fields
          WHERE form_id = $1
          ORDER BY sort_order, created_at`,
        [request.params.formId],
      );
      return response.json({ fields: result.rows });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Unable to load form fields." });
    }
  },
);

app.post(
  "/api/admin/forms/:formId/fields",
  requireAdmin,
  async (request, response) => {
    const formId = request.params.formId;
    const {
      fieldName,
      label,
      fieldType,
      placeholder = null,
      helpText = null,
      section = null,
      isRequired = false,
      options = null,
      sortOrder = 0,
      isActive = true,
    } = request.body;

    const cleanFieldName = String(fieldName || "").trim();
    const allowedTypes = [
      "text", "email", "tel", "number", "date", "textarea", "select", "checkbox",
    ];

    if (
      !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(cleanFieldName) ||
      !String(label || "").trim() ||
      !allowedTypes.includes(fieldType)
    ) {
      return response.status(400).json({
        error: "Valid field name, label and field type are required.",
      });
    }

    let normalizedOptions = null;
    if (fieldType === "select") {
      if (!Array.isArray(options) || options.length === 0) {
        return response
          .status(400)
          .json({ error: "Select fields need at least one option." });
      }
      normalizedOptions = options.map((option, index) => ({
        label: String(option.label ?? option.value ?? `Option ${index + 1}`),
        value: String(option.value ?? option.label ?? `option_${index + 1}`),
      }));
    }

    try {
      const result = await pool.query(
        `INSERT INTO form_fields
           (form_id, field_name, label, field_type, placeholder, help_text, section,
            is_required, options, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, form_id, field_name, label, field_type, placeholder, help_text,
                   section, is_required, options, sort_order, is_active, created_at, updated_at`,
        [
          formId,
          cleanFieldName,
          String(label).trim(),
          fieldType,
          placeholder,
          helpText,
          section,
          Boolean(isRequired),
          normalizedOptions,
          Number(sortOrder) || 0,
          Boolean(isActive),
        ],
      );
      await recordActivity({
        actorType: "admin",
        actorId: request.admin.adminId,
        actorEmail: request.admin.email,
        action: "form_field.created",
        targetType: "form_field",
        targetId: result.rows[0].id,
        details: `${cleanFieldName} (${fieldType})`,
        request,
      });
      return response.status(201).json({ field: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return response
          .status(409)
          .json({ error: "A field with this name already exists in the form." });
      }
      console.error(error);
      return response.status(500).json({ error: "Unable to create the field." });
    }
  },
);

app.patch("/api/admin/fields/:fieldId", requireAdmin, async (request, response) => {
  const fieldId = request.params.fieldId;
  const {
    label,
    fieldType,
    placeholder,
    helpText,
    section,
    isRequired,
    options,
    sortOrder,
    isActive,
  } = request.body;

  const allowedTypes = [
    "text", "email", "tel", "number", "date", "textarea", "select", "checkbox",
  ];
  if (fieldType !== undefined && !allowedTypes.includes(fieldType)) {
    return response.status(400).json({ error: "Invalid field type." });
  }

  let normalizedOptions;
  if (options !== undefined) {
    if (options === null) {
      normalizedOptions = null;
    } else if (!Array.isArray(options) || options.length === 0) {
      return response.status(400).json({ error: "Options must be a non-empty array." });
    } else {
      normalizedOptions = options.map((option, index) => ({
        label: String(option.label ?? option.value ?? `Option ${index + 1}`),
        value: String(option.value ?? option.label ?? `option_${index + 1}`),
      }));
    }
  }

  try {
    const result = await pool.query(
      `UPDATE form_fields
          SET label = COALESCE($1, label),
              field_type = COALESCE($2, field_type),
              placeholder = COALESCE($3, placeholder),
              help_text = COALESCE($4, help_text),
              section = COALESCE($5, section),
              is_required = COALESCE($6, is_required),
              options = COALESCE($7, options),
              sort_order = COALESCE($8, sort_order),
              is_active = COALESCE($9, is_active),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING id, form_id, field_name, label, field_type, placeholder, help_text,
                  section, is_required, options, sort_order, is_active, created_at, updated_at`,
      [
        label ? String(label).trim() : null,
        fieldType || null,
        placeholder ?? null,
        helpText ?? null,
        section ?? null,
        isRequired === undefined ? null : Boolean(isRequired),
        normalizedOptions === undefined ? null : normalizedOptions,
        sortOrder === undefined ? null : Number(sortOrder),
        isActive === undefined ? null : Boolean(isActive),
        fieldId,
      ],
    );
    if (!result.rows.length) {
      return response.status(404).json({ error: "Field not found." });
    }

    await recordActivity({
      actorType: "admin",
      actorId: request.admin.adminId,
      actorEmail: request.admin.email,
      action: "form_field.updated",
      targetType: "form_field",
      targetId: fieldId,
      details: result.rows[0].field_name,
      request,
    });
    return response.json({ field: result.rows[0] });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to update the field." });
  }
});

app.delete("/api/admin/fields/:fieldId", requireAdmin, async (request, response) => {
  const fieldId = request.params.fieldId;
  try {
    const result = await pool.query(
      `DELETE FROM form_fields WHERE id = $1 RETURNING id, field_name`,
      [fieldId],
    );
    if (!result.rows.length) {
      return response.status(404).json({ error: "Field not found." });
    }
    await recordActivity({
      actorType: "admin",
      actorId: request.admin.adminId,
      actorEmail: request.admin.email,
      action: "form_field.deleted",
      targetType: "form_field",
      targetId: fieldId,
      details: result.rows[0].field_name,
      request,
    });
    return response.json({ success: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to delete the field." });
  }
});

// ---- Public dynamic form rendering ----
app.get("/api/forms/:formKey", async (request, response) => {
  try {
    const formResult = await pool.query(
      `SELECT id, form_key, name, description FROM form_definitions WHERE form_key = $1`,
      [request.params.formKey],
    );
    if (!formResult.rows.length) {
      return response.status(404).json({ error: "Form not found." });
    }
    const fieldsResult = await pool.query(
      `SELECT id, field_name, label, field_type, placeholder, help_text, section,
              is_required, options, sort_order
         FROM form_fields
        WHERE form_id = $1 AND is_active = true
        ORDER BY sort_order, created_at`,
      [formResult.rows[0].id],
    );
    return response.json({
      form: { ...formResult.rows[0], fields: fieldsResult.rows },
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load the form." });
  }
});

app.post("/api/forms/:formKey/submit", async (request, response) => {
  try {
    const formResult = await pool.query(
      `SELECT id, form_key, name FROM form_definitions WHERE form_key = $1`,
      [request.params.formKey],
    );
    if (!formResult.rows.length) {
      return response.status(404).json({ error: "Form not found." });
    }
    const data = request.body.data || {};
    await recordActivity({
      actorType: "system",
      action: "form.submitted",
      targetType: "form",
      targetId: formResult.rows[0].id,
      details: `${formResult.rows[0].form_key} — ${Object.keys(data).length} fields`,
      request,
    });
    return response.json({ success: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to submit the form." });
  }
});

// ---- Elevate Winners ----
function publicWinner(row) {
  return {
    id: row.id,
    winningYear: row.winning_year,
    companyName: row.company_name,
    founderName: row.founder_name,
    mobileNumber: row.mobile_number,
    sector: row.sector,
    district: row.district,
    createdAt: row.created_at,
  };
}

app.get("/api/admin/winners/options", requireAdmin, async (_request, response) => {
  return response.json({
    sectors: WINNER_SECTORS,
    districts: KARNATAKA_DISTRICTS,
  });
});

app.get("/api/admin/winners", requireAdmin, async (request, response) => {
  const year = request.query.year;
  const columns =
    "id, winning_year, company_name, founder_name, mobile_number, sector, district, created_at";
  try {
    const result =
      year && year !== "All"
        ? await pool.query(
            `SELECT ${columns}
               FROM winners WHERE winning_year = $1
              ORDER BY created_at DESC`,
            [Number(year)],
          )
        : await pool.query(
            `SELECT ${columns}
               FROM winners
              ORDER BY winning_year DESC, created_at DESC`,
          );
    return response.json({ winners: result.rows.map(publicWinner) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load winners." });
  }
});

app.post("/api/admin/winners", requireAdmin, async (request, response) => {
  const year = Number(request.body.winningYear);
  const companyName = String(request.body.companyName || "").trim();
  const founderName = String(request.body.founderName || "").trim();
  const mobileNumber = String(request.body.mobileNumber || "").trim();
  const sector = String(request.body.sector || "").trim();
  const district = String(request.body.district || "").trim();

  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 3000 ||
    !companyName ||
    !founderName ||
    !mobileNumber ||
    !sector ||
    !district
  ) {
    return response.status(400).json({
      error:
        "Winning year, company name, founder name, mobile number, sector and district are all required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO winners (winning_year, company_name, founder_name, mobile_number, sector, district)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, winning_year, company_name, founder_name, mobile_number, sector, district, created_at`,
      [year, companyName, founderName, mobileNumber, sector, district],
    );
    await recordActivity({
      actorType: "admin",
      actorId: request.admin.adminId,
      actorEmail: request.admin.email,
      action: "winner.created",
      targetType: "winner",
      targetId: result.rows[0].id,
      details: `${companyName} — ${founderName} (${year})`,
      request,
    });
    return response.status(201).json({ winner: publicWinner(result.rows[0]) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to add the winner." });
  }
});

app.patch(
  "/api/admin/winners/:winnerId",
  requireAdmin,
  async (request, response) => {
    const winnerId = request.params.winnerId;
    const year = Number(request.body.winningYear);
    const companyName = String(request.body.companyName || "").trim();
    const founderName = String(request.body.founderName || "").trim();
    const mobileNumber = String(request.body.mobileNumber || "").trim();
    const sector = String(request.body.sector || "").trim();
    const district = String(request.body.district || "").trim();

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 3000 ||
      !companyName ||
      !founderName ||
      !mobileNumber ||
      !sector ||
      !district
    ) {
      return response.status(400).json({
        error:
          "Winning year, company name, founder name, mobile number, sector and district are all required.",
      });
    }

    try {
      const result = await pool.query(
        `UPDATE winners
            SET winning_year = $1, company_name = $2, founder_name = $3,
                mobile_number = $4, sector = $5, district = $6
          WHERE id = $7
          RETURNING id, winning_year, company_name, founder_name, mobile_number, sector, district, created_at`,
        [year, companyName, founderName, mobileNumber, sector, district, winnerId],
      );
      if (!result.rows.length) {
        return response.status(404).json({ error: "Winner not found." });
      }
      await recordActivity({
        actorType: "admin",
        actorId: request.admin.adminId,
        actorEmail: request.admin.email,
        action: "winner.updated",
        targetType: "winner",
        targetId: winnerId,
        details: `${companyName} — ${founderName} (${year})`,
        request,
      });
      return response.json({ winner: publicWinner(result.rows[0]) });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Unable to update the winner." });
    }
  },
);

app.delete(
  "/api/admin/winners/:winnerId",
  requireAdmin,
  async (request, response) => {
    try {
      const result = await pool.query(
        `DELETE FROM winners WHERE id = $1 RETURNING id, company_name`,
        [request.params.winnerId],
      );
      if (!result.rows.length) {
        return response.status(404).json({ error: "Winner not found." });
      }
      await recordActivity({
        actorType: "admin",
        actorId: request.admin.adminId,
        actorEmail: request.admin.email,
        action: "winner.deleted",
        targetType: "winner",
        targetId: request.params.winnerId,
        details: result.rows[0].company_name,
        request,
      });
      return response.json({ success: true });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "Unable to delete the winner." });
    }
  },
);

// ---- Public Elevate Winners (for registration auto-fill) ----
app.get("/api/winners/years", async (_request, response) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT winning_year FROM winners ORDER BY winning_year DESC`,
    );
    return response.json({ years: result.rows.map((row) => row.winning_year) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load winner years." });
  }
});

app.get("/api/winners", async (request, response) => {
  const year = request.query.year;
  try {
    const result = year
      ? await pool.query(
          `SELECT id, company_name, founder_name, mobile_number
             FROM winners WHERE winning_year = $1
            ORDER BY company_name`,
          [Number(year)],
        )
      : await pool.query(
          `SELECT id, company_name, founder_name, mobile_number
             FROM winners
            ORDER BY winning_year DESC, company_name`,
        );
    return response.json({
      winners: result.rows.map((row) => ({
        id: row.id,
        companyName: row.company_name,
        founderName: row.founder_name,
        mobileNumber: row.mobile_number,
      })),
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to load winners." });
  }
});

app.listen(port, () => {
  console.log(
    `Karnataka startup portal API listening on http://localhost:${port}`,
  );
  // Seed roles, permissions and the default admin once the server is up.
  seedAdminData().catch((error) =>
    console.error("Failed to seed admin data:", error.message),
  );
  // Ensure the Elevate Winners table exists.
  ensureWinnersTable().catch((error) =>
    console.error("Failed to ensure winners table:", error.message),
  );
});
