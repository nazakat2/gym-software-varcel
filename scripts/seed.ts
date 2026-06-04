import { db } from "../lib/db";
import { gymsTable, adminUsersTable, membersTable } from "../lib/db/src/schema";
import { hash } from "bcryptjs";
import { config } from "dotenv";

config();

/**
 * Seed Script
 * Creates initial data for development and testing
 */

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   🌱 Database Seed Script                                                ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);

  try {
    // Check if super admin already exists
    const existingSuperAdmin = await db.query.adminUsersTable.findFirst({
      where: (users, { isNull, eq }) =>
        isNull(users.gymId) && eq(users.role, "super_admin"),
    });

    if (existingSuperAdmin) {
      console.log("✓ Super admin already exists. Skipping...\n");
    } else {
      // Create super admin
      console.log("1️⃣  Creating super admin...");
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "Admin@123";
      const hashedPassword = await hash(superAdminPassword, 10);

      await db.insert(adminUsersTable).values({
        gymId: null, // NULL for super_admin
        name: process.env.SUPER_ADMIN_NAME || "Super Admin",
        email: process.env.SUPER_ADMIN_EMAIL || "superadmin@gym.com",
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
      });

      console.log("   ✓ Super admin created");
      console.log(`   Email: ${process.env.SUPER_ADMIN_EMAIL || "superadmin@gym.com"}`);
      console.log(`   Password: ${superAdminPassword}\n`);
    }

    // Check if demo gym exists
    const existingGym = await db.query.gymsTable.findFirst({
      where: (gyms, { eq }) => eq(gyms.slug, "demo-gym"),
    });

    if (existingGym) {
      console.log("✓ Demo gym already exists. Skipping...\n");
    } else if (process.env.NODE_ENV === "development") {
      // Create demo gym (development only)
      console.log("2️⃣  Creating demo gym...");
      const gym = await db
        .insert(gymsTable)
        .values({
          name: "Demo Gym",
          slug: "demo-gym",
          address: "123 Demo Street, Karachi",
          phone: "+92-300-1234567",
          email: "demo@gym.com",
          city: "Karachi",
          dailyFee: "200",
          weeklyFee: "800",
          monthlyFee: "3000",
          quarterlyFee: "8000",
          yearlyFee: "28000",
          subscriptionTier: "basic",
          subscriptionStatus: "active",
          isActive: true,
        })
        .returning();

      console.log(`   ✓ Demo gym created (ID: ${gym[0].id})\n`);

      // Create gym admin
      console.log("3️⃣  Creating gym admin...");
      const gymAdminPassword = "Admin@123";
      const hashedGymPassword = await hash(gymAdminPassword, 10);

      await db.insert(adminUsersTable).values({
        gymId: gym[0].id,
        name: "Gym Admin",
        email: "admin@demo-gym.com",
        password: hashedGymPassword,
        role: "gym_owner",
        permissions: {
          members: ["create", "read", "update", "delete"],
          billing: ["create", "read", "update", "delete"],
          attendance: ["create", "read", "update", "delete"],
          reports: ["read"],
          inventory: ["create", "read", "update", "delete"],
          settings: ["read", "update"],
        },
        isActive: true,
      });

      console.log("   ✓ Gym admin created");
      console.log(`   Email: admin@demo-gym.com`);
      console.log(`   Password: ${gymAdminPassword}\n`);

      // Create demo members
      console.log("4️⃣  Creating demo members...");
      const demoMembers = [
        {
          name: "Ahmed Ali",
          phone: "03001234567",
          cnic: "42101-1234567-1",
          plan: "monthly",
        },
        {
          name: "Fatima Khan",
          phone: "03001234568",
          cnic: "42101-1234567-2",
          plan: "quarterly",
        },
        {
          name: "Hassan Raza",
          phone: "03001234569",
          cnic: "42101-1234567-3",
          plan: "yearly",
        },
      ];

      for (let i = 0; i < demoMembers.length; i++) {
        const member = demoMembers[i];
        await db.insert(membersTable).values({
          gymId: gym[0].id,
          memberCode: `MEM-${String(i + 1).padStart(3, "0")}`,
          name: member.name,
          phone: member.phone,
          cnic: member.cnic,
          plan: member.plan,
          planStartDate: "2024-01-01",
          planExpiryDate:
            member.plan === "monthly"
              ? "2024-02-01"
              : member.plan === "quarterly"
              ? "2024-04-01"
              : "2025-01-01",
          status: "active",
          isActive: true,
        });
      }

      console.log(`   ✓ Created ${demoMembers.length} demo members\n`);
    }

    console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ✅ Seeding completed successfully!                                     ║
║                                                                           ║
║   You can now login with:                                                ║
║   - Super Admin: ${process.env.SUPER_ADMIN_EMAIL || "superadmin@gym.com"}                                  ║
║   - Gym Admin: admin@demo-gym.com (development only)                     ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
