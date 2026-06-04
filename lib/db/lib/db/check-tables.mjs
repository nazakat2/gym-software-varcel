import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from root directory
config({ path: resolve(__dirname, "../../.env") });

const { Pool } = pg;

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("📊 Checking database tables...\n");

    const result = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    if (result.rows.length === 0) {
      console.log("❌ No tables found in database!");
      console.log("   Database is empty - need to create schema\n");
    } else {
      console.log(`✅ Found ${result.rows.length} tables:\n`);
      result.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.tablename}`);
      });
      console.log();
    }
  } catch (error) {
    console.error("❌ Error checking tables:", error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
