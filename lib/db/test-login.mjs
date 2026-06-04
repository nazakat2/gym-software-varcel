import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const { Client } = pg;

async function testLogin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if user exists
    const result = await client.query(
      'SELECT id, name, email, password, role, status FROM admin_users WHERE email = $1',
      ['admin@gymplatform.com']
    );

    if (result.rows.length === 0) {
      console.log('❌ Super admin user not found!');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Super admin user found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}\n`);

    // Test password
    const isValid = await bcrypt.compare('admin123', user.password);
    console.log(`🔑 Password test: ${isValid ? '✅ VALID' : '❌ INVALID'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

testLogin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
