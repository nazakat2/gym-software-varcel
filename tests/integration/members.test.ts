import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "../../lib/db";
import { gymsTable, membersTable, adminUsersTable } from "../../lib/db/src/schema";
import { eq, sql } from "drizzle-orm";
import { sign } from "jsonwebtoken";

/**
 * Test Database Setup
 */
export class TestDatabase {
  private static testGymId: string;
  private static testUserId: string;

  /**
   * Setup test database before all tests
   */
  static async setup() {
    // Create test gym
    const gym = await db
      .insert(gymsTable)
      .values({
        name: "Test Gym",
        slug: "test-gym",
        address: "Test Address",
        phone: "+92-300-1234567",
        email: "test@gym.com",
      })
      .returning();

    this.testGymId = gym[0].id;

    // Create test admin user
    const user = await db
      .insert(adminUsersTable)
      .values({
        gymId: this.testGymId,
        name: "Test Admin",
        email: "admin@test.com",
        password: "hashed_password",
        role: "gym_owner",
      })
      .returning();

    this.testUserId = user[0].id;
  }

  /**
   * Cleanup test database after all tests
   */
  static async cleanup() {
    // Delete test gym (cascade will delete all related records)
    await db.delete(gymsTable).where(eq(gymsTable.id, this.testGymId));
  }

  /**
   * Clear specific table data between tests
   */
  static async clearTable(tableName: string) {
    await db.execute(
      sql`DELETE FROM ${sql.identifier(tableName)} WHERE gym_id = ${this.testGymId}`
    );
  }

  /**
   * Get test gym ID
   */
  static getGymId(): string {
    return this.testGymId;
  }

  /**
   * Get test user ID
   */
  static getUserId(): string {
    return this.testUserId;
  }

  /**
   * Generate test JWT token
   */
  static generateToken(): string {
    return sign(
      {
        userId: this.testUserId,
        gymId: this.testGymId,
        role: "gym_owner",
        email: "admin@test.com",
      },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" }
    );
  }
}

/**
 * Test Data Factories
 */
export class TestDataFactory {
  /**
   * Create test member
   */
  static async createMember(overrides: Partial<any> = {}) {
    const gymId = TestDatabase.getGymId();
    const userId = TestDatabase.getUserId();

    const member = await db
      .insert(membersTable)
      .values({
        gymId,
        memberCode: `MEM-TEST-${Date.now()}`,
        name: "Test Member",
        phone: "03001234567",
        cnic: "12345-1234567-1",
        plan: "monthly",
        planStartDate: "2024-01-01",
        planExpiryDate: "2024-02-01",
        status: "active",
        createdBy: userId,
        updatedBy: userId,
        ...overrides,
      })
      .returning();

    return member[0];
  }

  /**
   * Create multiple test members
   */
  static async createMembers(count: number) {
    const members = [];
    for (let i = 0; i < count; i++) {
      members.push(
        await this.createMember({
          name: `Test Member ${i + 1}`,
          phone: `030012345${String(i).padStart(2, "0")}`,
          cnic: `12345-123456${String(i).padStart(1, "0")}-1`,
        })
      );
    }
    return members;
  }
}

/**
 * Example Test Suite
 */
describe("Members API", () => {
  beforeAll(async () => {
    await TestDatabase.setup();
  });

  afterAll(async () => {
    await TestDatabase.cleanup();
  });

  beforeEach(async () => {
    await TestDatabase.clearTable("members");
  });

  describe("GET /api/members", () => {
    it("should return paginated members", async () => {
      // Create test data
      await TestDataFactory.createMembers(5);

      // Make request
      const response = await fetch("http://localhost:3000/api/members?page=1&limit=10", {
        headers: {
          Authorization: `Bearer ${TestDatabase.generateToken()}`,
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data).toHaveLength(5);
      expect(data.data.pagination.total).toBe(5);
    });

    it("should filter members by status", async () => {
      await TestDataFactory.createMember({ status: "active" });
      await TestDataFactory.createMember({ status: "expired" });

      const response = await fetch(
        "http://localhost:3000/api/members?status=active",
        {
          headers: {
            Authorization: `Bearer ${TestDatabase.generateToken()}`,
          },
        }
      );

      const data = await response.json();

      expect(data.data.data).toHaveLength(1);
      expect(data.data.data[0].status).toBe("active");
    });

    it("should search members by name", async () => {
      await TestDataFactory.createMember({ name: "John Doe" });
      await TestDataFactory.createMember({ name: "Jane Smith" });

      const response = await fetch(
        "http://localhost:3000/api/members?query=John",
        {
          headers: {
            Authorization: `Bearer ${TestDatabase.generateToken()}`,
          },
        }
      );

      const data = await response.json();

      expect(data.data.data).toHaveLength(1);
      expect(data.data.data[0].name).toBe("John Doe");
    });
  });

  describe("POST /api/members", () => {
    it("should create a new member", async () => {
      const memberData = {
        name: "New Member",
        phone: "03001234567",
        cnic: "12345-1234567-1",
        plan: "monthly",
        planStartDate: "2024-01-01",
      };

      const response = await fetch("http://localhost:3000/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TestDatabase.generateToken()}`,
        },
        body: JSON.stringify(memberData),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("New Member");
      expect(data.data.memberCode).toMatch(/^MEM-\d{3}$/);
    });

    it("should validate required fields", async () => {
      const response = await fetch("http://localhost:3000/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TestDatabase.generateToken()}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it("should enforce unique phone per gym", async () => {
      const phone = "03001234567";
      await TestDataFactory.createMember({ phone });

      const response = await fetch("http://localhost:3000/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TestDatabase.generateToken()}`,
        },
        body: JSON.stringify({
          name: "Duplicate Phone",
          phone,
          cnic: "12345-1234567-2",
          plan: "monthly",
          planStartDate: "2024-01-01",
        }),
      });

      expect(response.status).toBe(409);
    });
  });

  describe("PATCH /api/members/:id", () => {
    it("should update member details", async () => {
      const member = await TestDataFactory.createMember();

      const response = await fetch(
        `http://localhost:3000/api/members/${member.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TestDatabase.generateToken()}`,
          },
          body: JSON.stringify({
            name: "Updated Name",
          }),
        }
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.name).toBe("Updated Name");
    });

    it("should return 404 for non-existent member", async () => {
      const response = await fetch("http://localhost:3000/api/members/99999", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TestDatabase.generateToken()}`,
        },
        body: JSON.stringify({ name: "Test" }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/members/:id", () => {
    it("should soft delete a member", async () => {
      const member = await TestDataFactory.createMember();

      const response = await fetch(
        `http://localhost:3000/api/members/${member.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${TestDatabase.generateToken()}`,
          },
        }
      );

      expect(response.status).toBe(200);

      // Verify soft delete
      const deleted = await db.query.membersTable.findFirst({
        where: eq(membersTable.id, member.id),
      });

      expect(deleted?.deletedAt).not.toBeNull();
    });
  });

  describe("Multi-Tenancy Isolation", () => {
    it("should not access members from other gyms", async () => {
      // Create member in test gym
      const member = await TestDataFactory.createMember();

      // Create another gym
      const otherGym = await db
        .insert(gymsTable)
        .values({
          name: "Other Gym",
          slug: "other-gym",
          address: "Other Address",
          phone: "+92-300-9999999",
          email: "other@gym.com",
        })
        .returning();

      // Try to access member with other gym's token
      const otherToken = sign(
        {
          userId: "other-user-id",
          gymId: otherGym[0].id,
          role: "gym_owner",
          email: "other@gym.com",
        },
        process.env.JWT_SECRET || "test-secret"
      );

      const response = await fetch(
        `http://localhost:3000/api/members/${member.id}`,
        {
          headers: {
            Authorization: `Bearer ${otherToken}`,
          },
        }
      );

      expect(response.status).toBe(404);

      // Cleanup
      await db.delete(gymsTable).where(eq(gymsTable.id, otherGym[0].id));
    });
  });
});
