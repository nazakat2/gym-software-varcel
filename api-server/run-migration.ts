import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Migration: Make gym_id nullable in otps table
 * Run: node --import tsx run-migration.ts
 */

async function runMigration() {
  try {
    console.log("🔄 Running migration: Make gym_id nullable in otps table...");

    await db.execute(sql`ALTER TABLE otps ALTER COLUMN gym_id DROP NOT NULL`);

    console.log("✅ Migration completed successfully!");
    console.log("   gym_id column is now nullable in otps table");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
