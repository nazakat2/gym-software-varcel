import { db } from "./index";
import { adminUsersTable } from "./schema/admin-users";
import { eq } from "drizzle-orm";
import { hash } from "bcrypt";

/**
 * Seed Super Admin User
 * Creates a super admin account for managing the platform
 */
async function seedSuperAdmin() {
  console.log("🔐 Seeding super admin user...");

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@gymplatform.com";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin123";
  const superAdminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

  // Check if super admin already exists
  const [existing] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.email, superAdminEmail))
    .limit(1);

  if (existing) {
    console.log(`  ⏭️  Super admin "${superAdminEmail}" already exists, skipping...`);
    return;
  }

  // Hash password before storing
  const hashedPassword = await hash(superAdminPassword, 10);

  // Create super admin
  const [superAdmin] = await db
    .insert(adminUsersTable)
    .values({
      name: superAdminName,
      email: superAdminEmail,
      password: hashedPassword,
      role: "super_admin",
      gymId: null, // Super admin has no gym
      status: "active",
      permissions: {}, // Super admin has all permissions by default
    })
    .returning();

  console.log(`  ✅ Created super admin: ${superAdminName} (${superAdminEmail})`);
  console.log(`  🔑 Password: ${superAdminPassword}`);
  console.log("");
  console.log("⚠️  IMPORTANT: Change the password after first login!");
  console.log("✨ Super admin seeded successfully!");
}

// Run if called directly
if (require.main === module) {
  seedSuperAdmin()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error seeding super admin:", error);
      process.exit(1);
    });
}

export { seedSuperAdmin };
