import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import { config } from "dotenv";
import * as readline from "readline";

config();

/**
 * Automated Migration Script
 * Migrates single-tenant schema to multi-tenant with zero data loss
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   🔄 Multi-Tenant Migration Script                                       ║
║                                                                           ║
║   This script will migrate your database from single-tenant to           ║
║   multi-tenant architecture.                                             ║
║                                                                           ║
║   ⚠️  WARNING: This will modify your database schema!                    ║
║   ⚠️  Ensure you have a backup before proceeding!                        ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);

  // Step 1: Confirm backup
  const hasBackup = await question(
    "\n✓ Do you have a database backup? (yes/no): "
  );
  if (hasBackup.toLowerCase() !== "yes") {
    console.log("\n❌ Please create a backup first!");
    console.log("   Run: pg_dump -h HOST -U USER -d DB > backup.sql\n");
    process.exit(1);
  }

  // Step 2: Get gym details
  console.log("\n📝 Enter your gym details:\n");
  const gymName = await question("   Gym Name: ");
  const gymSlug = await question("   Gym Slug (URL-friendly): ");
  const gymAddress = await question("   Address: ");
  const gymPhone = await question("   Phone: ");
  const gymEmail = await question("   Email: ");

  console.log("\n🔍 Migration Preview:");
  console.log(`   - Create gym: ${gymName}`);
  console.log(`   - Migrate all existing data to this gym`);
  console.log(`   - Add multi-tenant indexes and constraints`);

  const confirm = await question("\n✓ Proceed with migration? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("\n❌ Migration cancelled.\n");
    process.exit(0);
  }

  console.log("\n🚀 Starting migration...\n");

  try {
    // Step 3: Create default gym
    console.log("1️⃣  Creating default gym...");
    const gym = await db.execute(sql`
      INSERT INTO gyms (
        id, name, slug, address, phone, email,
        currency, timezone,
        daily_fee, weekly_fee, monthly_fee, quarterly_fee, yearly_fee,
        subscription_tier, subscription_status, is_active
      ) VALUES (
        gen_random_uuid(),
        ${gymName},
        ${gymSlug},
        ${gymAddress},
        ${gymPhone},
        ${gymEmail},
        'PKR',
        'Asia/Karachi',
        200, 800, 3000, 8000, 28000,
        'basic',
        'active',
        true
      ) RETURNING id
    `);

    const gymId = gym.rows[0].id;
    console.log(`   ✓ Gym created with ID: ${gymId}\n`);

    // Step 4: Migrate members table
    console.log("2️⃣  Migrating members table...");
    await db.execute(sql`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS gym_id uuid;
      UPDATE members SET gym_id = ${gymId} WHERE gym_id IS NULL;
      ALTER TABLE members ALTER COLUMN gym_id SET NOT NULL;
      ALTER TABLE members ADD CONSTRAINT members_gym_id_fkey
        FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;

      ALTER TABLE members ADD COLUMN IF NOT EXISTS member_code text;
      UPDATE members SET member_code = 'MEM-' || LPAD(id::text, 3, '0') WHERE member_code IS NULL;
      ALTER TABLE members ALTER COLUMN member_code SET NOT NULL;

      ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS created_by uuid;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_by uuid;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();
      ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at timestamp;

      CREATE INDEX IF NOT EXISTS members_gym_active_idx ON members(gym_id, is_active);
      CREATE INDEX IF NOT EXISTS members_gym_status_idx ON members(gym_id, status);
      CREATE UNIQUE INDEX IF NOT EXISTS members_gym_phone_unique
        ON members(gym_id, phone) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS members_gym_cnic_unique
        ON members(gym_id, cnic) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS members_gym_code_unique
        ON members(gym_id, member_code) WHERE deleted_at IS NULL;
    `);
    console.log("   ✓ Members table migrated\n");

    // Step 5: Migrate admin_users table
    console.log("3️⃣  Migrating admin_users table...");
    await db.execute(sql`
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS gym_id uuid;
      UPDATE admin_users SET gym_id = ${gymId} WHERE gym_id IS NULL;

      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_by uuid;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_by uuid;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS deleted_at timestamp;

      CREATE INDEX IF NOT EXISTS admin_users_gym_id_idx ON admin_users(gym_id);
    `);
    console.log("   ✓ Admin users table migrated\n");

    // Step 6: Migrate invoices table
    console.log("4️⃣  Migrating invoices table...");
    await db.execute(sql`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gym_id uuid;
      UPDATE invoices SET gym_id = ${gymId} WHERE gym_id IS NULL;
      ALTER TABLE invoices ALTER COLUMN gym_id SET NOT NULL;
      ALTER TABLE invoices ADD CONSTRAINT invoices_gym_id_fkey
        FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;

      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number text;
      UPDATE invoices SET invoice_number = 'INV-2024-' || LPAD(id::text, 3, '0') WHERE invoice_number IS NULL;

      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by uuid;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_by uuid;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at timestamp;

      CREATE INDEX IF NOT EXISTS invoices_gym_id_idx ON invoices(gym_id);
      CREATE INDEX IF NOT EXISTS invoices_gym_status_idx ON invoices(gym_id, status);
    `);
    console.log("   ✓ Invoices table migrated\n");

    // Step 7: Migrate attendance table
    console.log("5️⃣  Migrating attendance table...");
    await db.execute(sql`
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gym_id uuid;
      UPDATE attendance SET gym_id = ${gymId} WHERE gym_id IS NULL;
      ALTER TABLE attendance ALTER COLUMN gym_id SET NOT NULL;
      ALTER TABLE attendance ADD CONSTRAINT attendance_gym_id_fkey
        FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;

      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_by uuid;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deleted_at timestamp;

      CREATE INDEX IF NOT EXISTS attendance_gym_id_idx ON attendance(gym_id);
      CREATE INDEX IF NOT EXISTS attendance_gym_date_idx ON attendance(gym_id, date);
    `);
    console.log("   ✓ Attendance table migrated\n");

    // Step 8: Migrate employees table
    console.log("6️⃣  Migrating employees table...");
    await db.execute(sql`
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS gym_id uuid;
      UPDATE employees SET gym_id = ${gymId} WHERE gym_id IS NULL;
      ALTER TABLE employees ALTER COLUMN gym_id SET NOT NULL;
      ALTER TABLE employees ADD CONSTRAINT employees_gym_id_fkey
        FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;

      ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_by uuid;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_by uuid;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at timestamp;

      CREATE INDEX IF NOT EXISTS employees_gym_id_idx ON employees(gym_id);
    `);
    console.log("   ✓ Employees table migrated\n");

    // Step 9: Verify migration
    console.log("7️⃣  Verifying migration...");
    const verification = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM members WHERE gym_id IS NULL) as members_null,
        (SELECT COUNT(*) FROM members WHERE member_code IS NULL) as members_no_code,
        (SELECT COUNT(*) FROM invoices WHERE gym_id IS NULL) as invoices_null,
        (SELECT COUNT(*) FROM attendance WHERE gym_id IS NULL) as attendance_null,
        (SELECT COUNT(*) FROM employees WHERE gym_id IS NULL) as employees_null
    `);

    const checks = verification.rows[0];
    if (
      checks.members_null === 0 &&
      checks.members_no_code === 0 &&
      checks.invoices_null === 0 &&
      checks.attendance_null === 0 &&
      checks.employees_null === 0
    ) {
      console.log("   ✓ All data migrated successfully\n");
    } else {
      console.log("   ⚠️  Some data may not have migrated correctly:");
      console.log(`      Members without gym_id: ${checks.members_null}`);
      console.log(`      Members without code: ${checks.members_no_code}`);
      console.log(`      Invoices without gym_id: ${checks.invoices_null}`);
      console.log(`      Attendance without gym_id: ${checks.attendance_null}`);
      console.log(`      Employees without gym_id: ${checks.employees_null}\n`);
    }

    console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ✅ Migration completed successfully!                                   ║
║                                                                           ║
║   Gym ID: ${gymId}                                        ║
║                                                                           ║
║   Next steps:                                                            ║
║   1. Run seed script to create super admin                               ║
║   2. Update your application code to use new schema                      ║
║   3. Test thoroughly before going live                                   ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.log("\n⚠️  Please restore from backup and try again.\n");
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
