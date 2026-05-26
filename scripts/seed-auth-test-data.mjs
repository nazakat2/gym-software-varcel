#!/usr/bin/env node
/**
 * Seed script to create test gym and admin user for authentication testing
 *
 * Usage: node scripts/seed-auth-test-data.mjs
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { gymsTable, adminUsersTable } from "../lib/db/src/schema/index.ts";

// Load environment variables
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding test data for authentication...\n");

  try {
    // 1. Create test gym
    console.log("📍 Creating test gym...");
    const [gym] = await db
      .insert(gymsTable)
      .values({
        name: "Core X Fitness Center",
        address: "123 Main Street, Karachi, Pakistan",
        phone: "+92-300-1234567",
        email: "info@corexgym.com",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    if (gym) {
      console.log(`✅ Gym created: ${gym.name} (ID: ${gym.id})`);
    } else {
      console.log("ℹ️  Gym already exists, fetching...");
      const existingGym = await db.query.gymsTable.findFirst({
        where: (gyms, { eq }) => eq(gyms.name, "Core X Fitness Center"),
      });
      if (!existingGym) {
        throw new Error("Failed to create or find gym");
      }
      console.log(`✅ Using existing gym: ${existingGym.name} (ID: ${existingGym.id})`);
      gym.id = existingGym.id;
    }

    // 2. Create test admin users
    console.log("\n👤 Creating test admin users...");

    const testUsers = [
      {
        name: "Admin User",
        email: "admin@corexgym.com",
        password: "Admin123!",
        role: "gym_owner",
        permissions: ["all"],
      },
      {
        name: "Manager User",
        email: "manager@corexgym.com",
        password: "Manager123!",
        role: "manager",
        permissions: ["members", "attendance", "billing", "reports"],
      },
      {
        name: "Staff User",
        email: "staff@corexgym.com",
        password: "Staff123!",
        role: "staff",
        permissions: ["members", "attendance"],
      },
    ];

    for (const userData of testUsers) {
      const hashedPassword = await hash(userData.password, 10);

      const [user] = await db
        .insert(adminUsersTable)
        .values({
          gymId: gym.id,
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
          permissions: userData.permissions,
          isActive: true,
        })
        .onConflictDoNothing()
        .returning();

      if (user) {
        console.log(`✅ User created: ${userData.name} (${userData.email})`);
        console.log(`   Role: ${userData.role}`);
        console.log(`   Password: ${userData.password}`);
      } else {
        console.log(`ℹ️  User already exists: ${userData.email}`);
      }
    }

    console.log("\n" + "═".repeat(70));
    console.log("🎉 Seed completed successfully!");
    console.log("═".repeat(70));
    console.log("\n📝 Test Credentials:\n");
    console.log("Admin (Full Access):");
    console.log("  Email: admin@corexgym.com");
    console.log("  Password: Admin123!");
    console.log("\nManager (Limited Access):");
    console.log("  Email: manager@corexgym.com");
    console.log("  Password: Manager123!");
    console.log("\nStaff (Basic Access):");
    console.log("  Email: staff@corexgym.com");
    console.log("  Password: Staff123!");
    console.log("\n🌐 Frontend: http://localhost:5173");
    console.log("🔌 Backend: http://localhost:5000");
    console.log("═".repeat(70) + "\n");
  } catch (error) {
    console.error("\n❌ Error seeding data:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
