// One-off helper: applies database/admin_schema.sql to the configured DB.
// Safe to run multiple times (schema uses IF NOT EXISTS guards).
// Usage: node database/apply-admin-schema.mjs
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (check your .env file).");
    process.exitCode = 1;
    return;
  }
  const schemaPath = path.resolve("database/admin_schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(sql);
    console.log("✅ Admin schema applied successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
