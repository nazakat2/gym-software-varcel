import pg from "pg";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: "../.env" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    console.log("🚀 Starting database migration...\n");

    // Read the SQL migration file
    const sql = readFileSync("../lib/db/drizzle/0000_fast_richard_fisk.sql", "utf8");

    // Execute the SQL
    await pool.query(sql);

    console.log("✅ Migration completed successfully!");
    console.log("   All 36 tables created\n");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
