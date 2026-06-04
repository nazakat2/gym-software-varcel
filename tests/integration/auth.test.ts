import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { hash } from "bcryptjs";
import { db } from "../../lib/db";
import { gymsTable, adminUsersTable, otpsTable } from "../../lib/db/src/schema";
import { eq, and } from "drizzle-orm";

/**
 * Authentication API Integration Tests
 */

let testGymId: string;
let testUserId: string;
let testUserEmail: string;
let testUserPassword: string;
let accessToken: string;

describe("Authentication API", () => {
  beforeAll(async () => {
    // Create test gym
    const gym = await db
      .insert(gymsTable)
      .values({
        name: "Test Gym Auth",
        slug: "test-gym-auth",
        address: "Test Address",
        phone: "+92-300-1234567",
        email: "test@gym-auth.com",
      })
      .returning();

    testGymId = gym[0].id;
    testUserEmail = "testuser@gym-auth.com";
    testUserPassword = "TestPass123";
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(gymsTable).where(eq(gymsTable.id, testGymId));
  });

  beforeEach(async () => {
    // Clear test data
    await db.delete(adminUsersTable).where(eq(adminUsersTable.gymId, testGymId));
    await db.delete(otpsTable).where(eq(otpsTable.gymId, testGymId));
  });

  describe("POST /api/auth/signup", () => {
    it("should create a new user account", async () => {
      const response = await fetch("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: testGymId,
          name: "Test User",
          email: testUserEmail,
          password: testUserPassword,
          role: "manager",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testUserEmail);
      expect(data.data.user.role).toBe("manager");
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.gym).toBeDefined();

      testUserId = data.data.user.id;
      accessToken = data.data.accessToken;
    });

    it("should reject weak passwords", async () => {
      const response = await fetch("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: testGymId,
          name: "Test User",
          email: "weak@test.com",
          password: "weak",
          role: "staff",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it("should reject duplicate email for same gym", async () => {
      // Create first user
      await db.insert(adminUsersTable).values({
        gymId: testGymId,
        name: "Existing User",
        email: testUserEmail,
        password: await hash(testUserPassword, 10),
        role: "staff",
      });

      // Try to create duplicate
      const response = await fetch("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: testGymId,
          name: "Duplicate User",
          email: testUserEmail,
          password: testUserPassword,
          role: "staff",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should reject invalid gym ID", async () => {
      const response = await fetch("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: "00000000-0000-0000-0000-000000000000",
          name: "Test User",
          email: "test@invalid.com",
          password: testUserPassword,
          role: "staff",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create test user
      const user = await db
        .insert(adminUsersTable)
        .values({
          gymId: testGymId,
          name: "Test User",
          email: testUserEmail,
          password: await hash(testUserPassword, 10),
          role: "manager",
          isActive: true,
        })
        .returning();

      testUserId = user[0].id;
    });

    it("should login with valid credentials", async () => {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testUserEmail);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();

      accessToken = data.data.accessToken;
    });

    it("should reject invalid password", async () => {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: "WrongPassword123",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should reject non-existent email", async () => {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@test.com",
          password: testUserPassword,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should update lastLoginAt on successful login", async () => {
      await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      const user = await db.query.adminUsersTable.findFirst({
        where: eq(adminUsersTable.id, testUserId),
      });

      expect(user?.lastLoginAt).not.toBeNull();
    });
  });

  describe("POST /api/auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create user and login
      await db.insert(adminUsersTable).values({
        gymId: testGymId,
        name: "Test User",
        email: testUserEmail,
        password: await hash(testUserPassword, 10),
        role: "manager",
        isActive: true,
      });

      const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      const loginData = await loginResponse.json();
      refreshToken = loginData.data.refreshToken;
    });

    it("should refresh access token with valid refresh token", async () => {
      const response = await fetch("http://localhost:3000/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
    });

    it("should reject invalid refresh token", async () => {
      const response = await fetch("http://localhost:3000/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "invalid-token" }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    beforeEach(async () => {
      await db.insert(adminUsersTable).values({
        gymId: testGymId,
        name: "Test User",
        email: testUserEmail,
        password: await hash(testUserPassword, 10),
        role: "manager",
        isActive: true,
      });
    });

    it("should send OTP for password reset", async () => {
      const response = await fetch("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testUserEmail }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify OTP was created
      const otp = await db.query.otpsTable.findFirst({
        where: and(
          eq(otpsTable.email, testUserEmail),
          eq(otpsTable.type, "reset")
        ),
      });

      expect(otp).toBeDefined();
      expect(otp?.otp).toHaveLength(6);
    });

    it("should not reveal if email doesn't exist", async () => {
      const response = await fetch("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent@test.com" }),
      });

      const data = await response.json();

      // Should still return success to prevent email enumeration
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    let validOTP: string;

    beforeEach(async () => {
      await db.insert(adminUsersTable).values({
        gymId: testGymId,
        name: "Test User",
        email: testUserEmail,
        password: await hash(testUserPassword, 10),
        role: "manager",
        isActive: true,
      });

      // Create OTP
      validOTP = "123456";
      await db.insert(otpsTable).values({
        gymId: testGymId,
        email: testUserEmail,
        otp: validOTP,
        type: "reset",
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
    });

    it("should reset password with valid OTP", async () => {
      const newPassword = "NewPass123";

      const response = await fetch("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          otp: validOTP,
          newPassword,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify can login with new password
      const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: newPassword,
        }),
      });

      expect(loginResponse.status).toBe(200);
    });

    it("should reject invalid OTP", async () => {
      const response = await fetch("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          otp: "999999",
          newPassword: "NewPass123",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should reject expired OTP", async () => {
      // Create expired OTP
      await db.delete(otpsTable).where(eq(otpsTable.email, testUserEmail));
      await db.insert(otpsTable).values({
        gymId: testGymId,
        email: testUserEmail,
        otp: "111111",
        type: "reset",
        expiresAt: Date.now() - 1000, // Expired
      });

      const response = await fetch("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          otp: "111111",
          newPassword: "NewPass123",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    beforeEach(async () => {
      // Create user and login
      await db.insert(adminUsersTable).values({
        gymId: testGymId,
        name: "Test User",
        email: testUserEmail,
        password: await hash(testUserPassword, 10),
        role: "manager",
        isActive: true,
      });

      const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      const loginData = await loginResponse.json();
      accessToken = loginData.data.accessToken;
    });

    it("should get current user profile", async () => {
      const response = await fetch("http://localhost:3000/api/auth/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testUserEmail);
      expect(data.data.gym).toBeDefined();
    });

    it("should reject request without token", async () => {
      const response = await fetch("http://localhost:3000/api/auth/me");

      expect(response.status).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      const response = await fetch("http://localhost:3000/api/auth/me", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/auth/change-password", () => {
    beforeEach(async () => {
      await db.insert(adminUsersTable).values({
        gymId: testGymId,
        name: "Test User",
        email: testUserEmail,
        password: await hash(testUserPassword, 10),
        role: "manager",
        isActive: true,
      });

      const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      const loginData = await loginResponse.json();
      accessToken = loginData.data.accessToken;
    });

    it("should change password with valid current password", async () => {
      const newPassword = "NewPass123";

      const response = await fetch("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: testUserPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify can login with new password
      const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: newPassword,
        }),
      });

      expect(loginResponse.status).toBe(200);
    });

    it("should reject incorrect current password", async () => {
      const response = await fetch("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: "WrongPassword123",
          newPassword: "NewPass123",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });
});
