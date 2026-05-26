import { Router } from "express";
import { z } from "zod/v4";
import { hash, compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "../../lib/db";
import { adminUsersTable, otpsTable, gymsTable } from "../../lib/db/src/schema";
import { validate, asyncHandler, successResponse, UnauthorizedError, NotFoundError, ValidationError } from "../../lib/middleware/error-handler";
import { authLimiter } from "../../lib/middleware/security";
import { ValidationUtils } from "../../lib/utils/helpers";

const router = Router();

// Apply strict rate limiting to all auth routes
router.use(authLimiter);

/**
 * Validation Schemas
 */
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  role: z.enum(["gym_owner", "manager", "receptionist", "trainer", "staff"]).default("staff"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  type: z.enum(["signup", "reset", "verify"]),
});

/**
 * Helper Functions
 */

// Generate JWT tokens
function generateTokens(user: any) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET not configured");
  }

  const payload = {
    userId: user.id,
    gymId: user.gymId,
    role: user.role,
    email: user.email,
    permissions: user.permissions,
  };

  const accessToken = sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  const refreshToken = sign(
    { userId: user.id },
    jwtSecret,
    { expiresIn: "30d" }
  );

  return { accessToken, refreshToken };
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via email (placeholder - implement actual email sending)
async function sendOTPEmail(email: string, otp: string, type: string) {
  // TODO: Implement actual email sending with your email service
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ OTP Email (Development Mode)                                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ To: ${email.padEnd(69)}║
║ Type: ${type.padEnd(67)}║
║ OTP: ${otp.padEnd(68)}║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);

  // In production, use a service like:
  // - SendGrid
  // - AWS SES
  // - Mailgun
  // - Resend
}

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user by email
    const user = await db.query.adminUsersTable.findFirst({
      where: and(
        eq(adminUsersTable.email, email),
        eq(adminUsersTable.isActive, true),
        isNull(adminUsersTable.deletedAt)
      ),
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Verify password
    if (!user.password) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Update last login
    await db
      .update(adminUsersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminUsersTable.id, user.id));

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Get gym details (if not super admin)
    let gym = null;
    if (user.gymId) {
      gym = await db.query.gymsTable.findFirst({
        where: eq(gymsTable.id, user.gymId),
      });
    }

    res.json(
      successResponse(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            gymId: user.gymId,
            permissions: user.permissions,
          },
          gym,
          accessToken,
          refreshToken,
        },
        "Login successful"
      )
    );
  })
);

/**
 * POST /api/auth/signup
 * Register a new admin user (gym-scoped)
 */
router.post(
  "/signup",
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const { gymId, name, email, password, role } = req.body;

    // Verify gym exists
    const gym = await db.query.gymsTable.findFirst({
      where: and(
        eq(gymsTable.id, gymId),
        eq(gymsTable.isActive, true),
        isNull(gymsTable.deletedAt)
      ),
    });

    if (!gym) {
      throw new NotFoundError("Gym not found");
    }

    // Check if email already exists for this gym
    const existingUser = await db.query.adminUsersTable.findFirst({
      where: and(
        eq(adminUsersTable.gymId, gymId),
        eq(adminUsersTable.email, email),
        isNull(adminUsersTable.deletedAt)
      ),
    });

    if (existingUser) {
      throw new ValidationError("Email already registered for this gym");
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user
    const user = await db
      .insert(adminUsersTable)
      .values({
        gymId,
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
      })
      .returning();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user[0]);

    res.status(201).json(
      successResponse(
        {
          user: {
            id: user[0].id,
            name: user[0].name,
            email: user[0].email,
            role: user[0].role,
            gymId: user[0].gymId,
          },
          gym,
          accessToken,
          refreshToken,
        },
        "Account created successfully"
      )
    );
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not configured");
    }

    try {
      // Verify refresh token
      const decoded = verify(refreshToken, jwtSecret) as { userId: string };

      // Get user
      const user = await db.query.adminUsersTable.findFirst({
        where: and(
          eq(adminUsersTable.id, decoded.userId),
          eq(adminUsersTable.isActive, true),
          isNull(adminUsersTable.deletedAt)
        ),
      });

      if (!user) {
        throw new UnauthorizedError("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = generateTokens(user);

      res.json(
        successResponse(
          {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          },
          "Token refreshed successfully"
        )
      );
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  })
);

/**
 * POST /api/auth/forgot-password
 * Initiate password reset by sending OTP
 */
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Find user
    const user = await db.query.adminUsersTable.findFirst({
      where: and(
        eq(adminUsersTable.email, email),
        eq(adminUsersTable.isActive, true),
        isNull(adminUsersTable.deletedAt)
      ),
    });

    // Always return success (don't reveal if email exists)
    if (!user) {
      res.json(
        successResponse(
          null,
          "If the email exists, an OTP has been sent"
        )
      );
      return;
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Delete old OTPs for this email
    await db
      .delete(otpsTable)
      .where(
        and(
          eq(otpsTable.email, email),
          eq(otpsTable.type, "reset")
        )
      );

    // Save OTP
    await db.insert(otpsTable).values({
      gymId: user.gymId,
      email,
      otp,
      type: "reset",
      expiresAt,
    });

    // Send OTP via email
    await sendOTPEmail(email, otp, "Password Reset");

    res.json(
      successResponse(
        null,
        "If the email exists, an OTP has been sent"
      )
    );
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password using OTP
 */
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;

    // Verify OTP
    const otpRecord = await db.query.otpsTable.findFirst({
      where: and(
        eq(otpsTable.email, email),
        eq(otpsTable.otp, otp),
        eq(otpsTable.type, "reset"),
        gt(otpsTable.expiresAt, Date.now())
      ),
    });

    if (!otpRecord) {
      throw new ValidationError("Invalid or expired OTP");
    }

    // Find user
    const user = await db.query.adminUsersTable.findFirst({
      where: and(
        eq(adminUsersTable.email, email),
        eq(adminUsersTable.isActive, true),
        isNull(adminUsersTable.deletedAt)
      ),
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 10);

    // Update password
    await db
      .update(adminUsersTable)
      .set({ password: hashedPassword })
      .where(eq(adminUsersTable.id, user.id));

    // Delete used OTP
    await db.delete(otpsTable).where(eq(otpsTable.id, otpRecord.id));

    res.json(
      successResponse(null, "Password reset successful")
    );
  })
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP for various purposes
 */
router.post(
  "/verify-otp",
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { email, otp, type } = req.body;

    // Verify OTP
    const otpRecord = await db.query.otpsTable.findFirst({
      where: and(
        eq(otpsTable.email, email),
        eq(otpsTable.otp, otp),
        eq(otpsTable.type, type),
        gt(otpsTable.expiresAt, Date.now())
      ),
    });

    if (!otpRecord) {
      throw new ValidationError("Invalid or expired OTP");
    }

    // Delete used OTP
    await db.delete(otpsTable).where(eq(otpsTable.id, otpRecord.id));

    res.json(
      successResponse(
        { verified: true },
        "OTP verified successfully"
      )
    );
  })
);

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, optional server-side blacklist)
 */
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    // In a stateless JWT system, logout is primarily client-side
    // (remove token from storage)

    // Optional: Implement token blacklist in Redis for immediate invalidation
    // const token = req.headers.authorization?.substring(7);
    // await redis.set(`blacklist:${token}`, "1", "EX", 7 * 24 * 60 * 60);

    res.json(
      successResponse(null, "Logout successful")
    );
  })
);

export default router;
