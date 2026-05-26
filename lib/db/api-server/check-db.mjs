import pg from "pg";
import { config } from "dotenv";

config({ path: "../.env" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
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
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();
