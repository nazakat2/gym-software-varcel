import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function seedSuperAdmin() {
  console.log('🔐 Seeding super admin user...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    const superAdminEmail = 'admin@gymplatform.com';
    const superAdminPassword = 'admin123';
    const superAdminName = 'Super Admin';

    // Check if super admin already exists
    const checkResult = await client.query(
      'SELECT * FROM admin_users WHERE email = $1 LIMIT 1',
      [superAdminEmail]
    );

    if (checkResult.rows.length > 0) {
      console.log(`  ⏭️  Super admin "${superAdminEmail}" already exists, skipping...`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    // Insert super admin
    const insertResult = await client.query(
      `INSERT INTO admin_users (name, email, password, role, gym_id, status, permissions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [superAdminName, superAdminEmail, hashedPassword, 'super_admin', null, 'active', '{}']
    );

    console.log(`  ✅ Created super admin: ${superAdminName} (${superAdminEmail})`);
    console.log(`  🔑 Password: ${superAdminPassword}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('✨ Super admin seeded successfully!');
  } catch (error) {
    console.error('Error seeding super admin:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedSuperAdmin()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
