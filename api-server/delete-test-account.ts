import { db } from "@workspace/db";
import { adminUsersTable, gymsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Delete test gym account
 * Run: node --loader tsx delete-test-account.ts
 */

const ownerEmail = "mrsarimofficial@gmail.com";
const gymEmail = "mrsarimofficial@gmail.com";

async function deleteTestAccount() {
  try {
    console.log("🔍 Searching for test account...");

    // Find admin user
    const [adminUser] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, ownerEmail));

    if (adminUser) {
      console.log(`✅ Found admin user: ${adminUser.name} (${adminUser.email})`);
      console.log(`   Gym ID: ${adminUser.gymId}`);

      // Delete admin user (will cascade delete related records)
      await db.delete(adminUsersTable).where(eq(adminUsersTable.email, ownerEmail));
      console.log("✅ Deleted admin user");
    } else {
      console.log("ℹ️  No admin user found with this email");
    }

    // Find and delete gym
    const [gym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.email, gymEmail));

    if (gym) {
      console.log(`✅ Found gym: ${gym.name} (${gym.email})`);
      await db.delete(gymsTable).where(eq(gymsTable.email, gymEmail));
      console.log("✅ Deleted gym");
    } else {
      console.log("ℹ️  No gym found with this email");
    }

    console.log("\n✅ Test account cleanup complete!");
    console.log("You can now register again with the same email.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting test account:", error);
    process.exit(1);
  }
}

deleteTestAccount();
