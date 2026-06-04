import pg from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function runSQL() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const sql = readFileSync('insert-super-admin.sql', 'utf8');
    const result = await client.query(sql);

    if (result.rows.length > 0) {
      console.log('✅ Super admin created:');
      console.log(result.rows[0]);
    } else {
      console.log('⏭️  Super admin already exists');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runSQL()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
