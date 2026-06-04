#!/usr/bin/env node
/**
 * Seed script to create test gym and admin user for authentication testing
 */

import postgres from "postgres";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { config } from "dotenv";

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function seed() {
  console.log("🌱 Seeding test data for authentication...\n");

  try {
    // 1. Create test gym
    console.log("📍 Creating test gym...");

    const gymId = randomUUID();
    const gymResult = await sql`
      INSERT INTO gyms (id, name, address, phone, email, is_active, created_at, updated_at)
      VALUES (
        ${gymId},
        'Core X Fitness Center',
        '123 Main Street, Karachi, Pakistan',
        '+92-300-1234567',
        'info@corexgym.com',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name
    `;

    let finalGymId = gymId;
    if (gymResult.length > 0) {
      console.log(`✅ Gym created: ${gymResult[0].name} (ID: ${gymResult[0].id})`);
      finalGymId = gymResult[0].id;
    } else {
      console.log("ℹ️  Gym already exists, fetching...");
      const existingGym = await sql`
        SELECT id, name FROM gyms WHERE email = 'info@corexgym.com' LIMIT 1
      `;
      if (existingGym.length > 0) {
        finalGymId = existingGym[0].id;
        console.log(`✅ Using existing gym: ${existingGym[0].name} (ID: ${existingGym[0].id})`);
      }
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
      const userId = randomUUID();

      const userResult = await sql`
        INSERT INTO admin_users (
          id, gym_id, name, email, password, role, permissions, is_active, created_at, updated_at
        )
        VALUES (
          ${userId},
          ${finalGymId},
          ${userData.name},
          ${userData.email},
          ${hashedPassword},
          ${userData.role},
          ${JSON.stringify(userData.permissions)},
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (gym_id, email) DO NOTHING
        RETURNING id, name, email, role
      `;

      if (userResult.length > 0) {
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
    await sql.end();
  }
}

seed();
