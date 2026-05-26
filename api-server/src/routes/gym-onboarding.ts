import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { gymsTable, adminUsersTable, otpsTable } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { EmailService } from "../services/email.service";
import { WhatsAppService } from "../services/whatsapp.service";

const router = Router();

/**
 * Generate a 6-digit OTP
 */
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Validation schema for gym registration
const gymRegistrationSchema = z.object({
  // Gym details
  gymName: z.string().min(2, "Gym name must be at least 2 characters"),
  address: z.string().min(5, "Address is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Valid email required"),
  city: z.string().optional(),

  // Owner details
  ownerName: z.string().min(2, "Owner name is required"),
  ownerEmail: z.string().email("Valid owner email required"),
  ownerPassword: z.string().min(6, "Password must be at least 6 characters"),

  // Business settings (optional)
  currency: z.string().default("PKR"),
  timezone: z.string().default("Asia/Karachi"),
});

/**
 * Generate a unique slug from gym name
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Add random suffix to ensure uniqueness
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

/**
 * @openapi
 * /onboarding/send-otp:
 *   post:
 *     tags:
 *       - Gym Onboarding
 *     summary: Send OTP for email verification (Step 1)
 *     description: |
 *       Validates registration data and sends OTP to owner's email.
 *       OTP expires in 10 minutes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gymName
 *               - address
 *               - phone
 *               - email
 *               - ownerName
 *               - ownerEmail
 *               - ownerPassword
 *             properties:
 *               gymName:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               city:
 *                 type: string
 *               ownerName:
 *                 type: string
 *               ownerEmail:
 *                 type: string
 *               ownerPassword:
 *                 type: string
 *               currency:
 *                 type: string
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Validation error or duplicate email
 */
router.post("/onboarding/send-otp", async (req, res) => {
  try {
    // Validate input
    const validationResult = gymRegistrationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const data = validationResult.data;

    // Check if gym email already exists
    const [existingGym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.email, data.email.toLowerCase().trim()));

    if (existingGym) {
      return res.status(400).json({
        success: false,
        error: "A gym with this email already exists",
      });
    }

    // Check if owner email already exists
    const [existingOwner] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, data.ownerEmail.toLowerCase().trim()));

    if (existingOwner) {
      return res.status(400).json({
        success: false,
        error: "An account with this owner email already exists",
      });
    }

    // Delete any existing OTPs for this email and type
    await db
      .delete(otpsTable)
      .where(
        and(
          eq(otpsTable.email, data.ownerEmail.toLowerCase().trim()),
          eq(otpsTable.type, "gym_registration")
        )
      );

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP with registration data
    // For gym registration, gymId is not yet available
    const otpData: any = {
      email: data.ownerEmail.toLowerCase().trim(),
      otp,
      type: "gym_registration",
      expiresAt,
      data: JSON.stringify(data),
    };

    await db.insert(otpsTable).values(otpData);

    // Send OTP email
    await EmailService.sendOtpEmail(
      data.ownerEmail.toLowerCase().trim(),
      otp,
      data.ownerName
    );

    return res.json({
      success: true,
      message: "OTP sent to your email. Please check your inbox.",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[SEND OTP ERROR]", errorMessage);
    return res.status(500).json({
      success: false,
      error: "Failed to send OTP",
      details: errorMessage,
    });
  }
});

/**
 * @openapi
 * /onboarding/verify-otp:
 *   post:
 *     tags:
 *       - Gym Onboarding
 *     summary: Verify OTP and complete registration (Step 2)
 *     description: |
 *       Verifies OTP and creates gym account with 14-day trial.
 *       Returns JWT token for immediate access.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ownerEmail
 *               - otp
 *             properties:
 *               ownerEmail:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: Registration completed successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post("/onboarding/verify-otp", async (req, res) => {
  // Disable Sentry context for this route to avoid serialization issues with bigint timestamps
  const Sentry = require("@sentry/node");
  return Sentry.withIsolationScope(() => {
    return handleVerifyOtp(req, res);
  });
});

async function handleVerifyOtp(req: any, res: any) {
  try {
    const { ownerEmail, otp } = req.body;

    if (!ownerEmail || !otp) {
      return res.status(400).json({
        success: false,
        error: "Email and OTP are required",
      });
    }

    console.log("[DEBUG] Verifying OTP:", { ownerEmail, otp, otpType: typeof otp });

    // Find valid OTP (most recent first)
    const otpRecords = await db
      .select({
        id: otpsTable.id,
        data: otpsTable.data,
        otp: otpsTable.otp,
        expiresAt: otpsTable.expiresAt,
      })
      .from(otpsTable)
      .where(
        and(
          eq(otpsTable.email, ownerEmail.toLowerCase().trim()),
          eq(otpsTable.type, "gym_registration"),
          gt(otpsTable.expiresAt, Date.now())
        )
      )
      .orderBy(desc(otpsTable.createdAt))
      .limit(5);

    console.log("[DEBUG] Found OTP records:", otpRecords.length);
    if (otpRecords.length > 0) {
      console.log("[DEBUG] OTP values:", otpRecords.map(r => ({ otp: r.otp, expires: new Date(r.expiresAt) })));
    }

    // Find matching OTP
    const matchingRecord = otpRecords.find(r => r.otp === otp);

    if (!matchingRecord) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired OTP",
      });
    }

    console.log("[DEBUG] OTP matched successfully");

    // Extract data immediately and discard the record object
    const otpId = matchingRecord.id;
    const registrationDataJson = matchingRecord.data || "{}";

    // Parse registration data
    const data = JSON.parse(registrationDataJson);

    // Validate parsed data
    const validationResult = gymRegistrationSchema.safeParse(data);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid registration data",
      });
    }

    const registrationData = validationResult.data;

    // Double-check emails are still available
    const [existingGym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.email, registrationData.email.toLowerCase().trim()));

    if (existingGym) {
      return res.status(400).json({
        success: false,
        error: "A gym with this email already exists",
      });
    }

    const [existingOwner] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, registrationData.ownerEmail.toLowerCase().trim()));

    if (existingOwner) {
      return res.status(400).json({
        success: false,
        error: "An account with this owner email already exists",
      });
    }

    // Generate unique slug
    const slug = generateSlug(registrationData.gymName);

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Create gym
    const gymRecords = await db
      .insert(gymsTable)
      .values({
        name: registrationData.gymName,
        slug,
        address: registrationData.address,
        phone: registrationData.phone,
        email: registrationData.email.toLowerCase().trim(),
        city: registrationData.city || null,
        currency: registrationData.currency,
        timezone: registrationData.timezone,
        subscriptionTier: "basic",
        subscriptionStatus: "trial",
        subscriptionExpiresAt: trialEndsAt, // Pass Date object, not string
        isActive: true,
      })
      .returning({
        id: gymsTable.id,
        name: gymsTable.name,
        slug: gymsTable.slug,
        email: gymsTable.email,
        phone: gymsTable.phone,
        address: gymsTable.address,
        city: gymsTable.city,
        subscriptionStatus: gymsTable.subscriptionStatus,
        subscriptionTier: gymsTable.subscriptionTier,
        subscriptionExpiresAt: gymsTable.subscriptionExpiresAt,
      });

    const newGym = gymRecords[0];

    if (!newGym) {
      throw new Error("Failed to create gym");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registrationData.ownerPassword, 10);

    // Create gym owner admin user
    const ownerRecords = await db
      .insert(adminUsersTable)
      .values({
        name: registrationData.ownerName,
        email: registrationData.ownerEmail.toLowerCase().trim(),
        password: hashedPassword,
        role: "gym_owner",
        gymId: newGym.id,
        status: "active",
        permissions: ["*"],
      })
      .returning({
        id: adminUsersTable.id,
        name: adminUsersTable.name,
        email: adminUsersTable.email,
        role: adminUsersTable.role,
      });

    const newOwner = ownerRecords[0];

    if (!newOwner) {
      // Rollback: delete the gym
      await db.delete(gymsTable).where(eq(gymsTable.id, newGym.id));
      throw new Error("Failed to create owner account");
    }

    // Delete used OTP
    await db.delete(otpsTable).where(eq(otpsTable.id, otpId));

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not configured");
    }

    const token = jwt.sign(
      {
        userId: String(newOwner.id),
        gymId: newGym.id,
        role: "gym_owner",
        email: newOwner.email,
        permissions: {
          members: ["*"],
          billing: ["*"],
          attendance: ["*"],
          reports: ["*"],
          inventory: ["*"],
          settings: ["*"],
        },
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Send welcome email (async, don't wait)
    EmailService.sendWelcomeEmail(
      newOwner.email,
      newGym.name,
      newOwner.name
    ).catch((err) => console.error("Failed to send welcome email:", err));

    // Send WhatsApp welcome message if phone available
    if (newGym.phone) {
      WhatsAppService.sendWelcomeMessage(
        newGym.phone,
        newGym.name,
        newOwner.name
      ).catch((err) => console.error("Failed to send welcome WhatsApp:", err));
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Gym registered successfully! Your 14-day trial has started.",
      token,
      gym: {
        id: newGym.id,
        name: newGym.name,
        slug: newGym.slug,
        email: newGym.email,
        phone: newGym.phone,
        address: newGym.address,
        city: newGym.city,
        subscriptionStatus: newGym.subscriptionStatus,
        subscriptionTier: newGym.subscriptionTier,
        trialEndsAt: newGym.subscriptionExpiresAt,
      },
      owner: {
        id: newOwner.id,
        name: newOwner.name,
        email: newOwner.email,
        role: newOwner.role,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("[VERIFY OTP ERROR]", errorMessage);
    console.error("[VERIFY OTP STACK]", errorStack);
    return res.status(500).json({
      success: false,
      error: "Failed to verify OTP and complete registration",
      details: errorMessage,
    });
  }
}

/**
 * @openapi
 * /onboarding/register:
 *   post:
 *     tags:
 *       - Gym Onboarding
 *     summary: Register a new gym (Public)
 *     description: |
 *       Public endpoint for gym owners to register their gym.
 *       Creates gym, owner account, and starts 14-day trial.
 *       Returns JWT token for immediate access.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gymName
 *               - address
 *               - phone
 *               - email
 *               - ownerName
 *               - ownerEmail
 *               - ownerPassword
 *             properties:
 *               gymName:
 *                 type: string
 *                 example: "Elite Fitness Center"
 *               address:
 *                 type: string
 *                 example: "123 Main Street, Block A"
 *               phone:
 *                 type: string
 *                 example: "+923001234567"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "info@elitefitness.com"
 *               city:
 *                 type: string
 *                 example: "Karachi"
 *               ownerName:
 *                 type: string
 *                 example: "Ahmed Khan"
 *               ownerEmail:
 *                 type: string
 *                 format: email
 *                 example: "ahmed@elitefitness.com"
 *               ownerPassword:
 *                 type: string
 *                 format: password
 *                 example: "securepass123"
 *               currency:
 *                 type: string
 *                 default: "PKR"
 *               timezone:
 *                 type: string
 *                 default: "Asia/Karachi"
 *     responses:
 *       201:
 *         description: Gym registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 gym:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     subscriptionStatus:
 *                       type: string
 *                     trialEndsAt:
 *                       type: string
 *                 owner:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       400:
 *         description: Validation error or duplicate email
 *       500:
 *         description: Server error
 */
router.post("/onboarding/register", async (req, res) => {
  try {
    // Validate input
    const validationResult = gymRegistrationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const data = validationResult.data;

    // Check if gym email already exists
    const [existingGym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.email, data.email.toLowerCase().trim()));

    if (existingGym) {
      return res.status(400).json({
        success: false,
        error: "A gym with this email already exists",
      });
    }

    // Check if owner email already exists
    const [existingOwner] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, data.ownerEmail.toLowerCase().trim()));

    if (existingOwner) {
      return res.status(400).json({
        success: false,
        error: "An account with this owner email already exists",
      });
    }

    // Generate unique slug
    const slug = generateSlug(data.gymName);

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Create gym
    const [newGym] = await db
      .insert(gymsTable)
      .values({
        name: data.gymName,
        slug,
        address: data.address,
        phone: data.phone,
        email: data.email.toLowerCase().trim(),
        city: data.city || null,
        currency: data.currency,
        timezone: data.timezone,
        subscriptionTier: "basic",
        subscriptionStatus: "trial", // Trial status
        subscriptionExpiresAt: trialEndsAt, // Pass Date object, not string
        isActive: true,
      })
      .returning();

    if (!newGym) {
      throw new Error("Failed to create gym");
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(data.ownerPassword, 10);

    // Create gym owner admin user
    const [newOwner] = await db
      .insert(adminUsersTable)
      .values({
        name: data.ownerName,
        email: data.ownerEmail.toLowerCase().trim(),
        password: hashedPassword,
        role: "gym_owner",
        gymId: newGym.id,
        status: "active",
        permissions: ["*"], // Full permissions for gym owner
      })
      .returning();

    if (!newOwner) {
      // Rollback: delete the gym
      await db.delete(gymsTable).where(eq(gymsTable.id, newGym.id));
      throw new Error("Failed to create owner account");
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not configured");
    }

    const token = jwt.sign(
      {
        userId: String(newOwner.id),
        gymId: newGym.id,
        role: "gym_owner",
        email: newOwner.email,
        permissions: {
          members: ["*"],
          billing: ["*"],
          attendance: ["*"],
          reports: ["*"],
          inventory: ["*"],
          settings: ["*"],
        },
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Send welcome email (async, don't wait)
    EmailService.sendWelcomeEmail(
      newOwner.email,
      newGym.name,
      newOwner.name
    ).catch((err) => console.error("Failed to send welcome email:", err));

    // Send WhatsApp welcome message if phone number available
    if (newGym.phone) {
      WhatsAppService.sendWelcomeMessage(
        newGym.phone,
        newGym.name,
        newOwner.name
      ).catch((err) => console.error("Failed to send welcome WhatsApp:", err));
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Gym registered successfully! Your 14-day trial has started.",
      token,
      gym: {
        id: newGym.id,
        name: newGym.name,
        slug: newGym.slug,
        email: newGym.email,
        phone: newGym.phone,
        address: newGym.address,
        city: newGym.city,
        subscriptionStatus: newGym.subscriptionStatus,
        subscriptionTier: newGym.subscriptionTier,
        trialEndsAt: newGym.subscriptionExpiresAt,
      },
      owner: {
        id: newOwner.id,
        name: newOwner.name,
        email: newOwner.email,
        role: newOwner.role,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[GYM REGISTRATION ERROR]", errorMessage);
    return res.status(500).json({
      success: false,
      error: "Failed to register gym",
      details: errorMessage,
    });
  }
});

/**
 * @openapi
 * /onboarding/check-availability:
 *   post:
 *     tags:
 *       - Gym Onboarding
 *     summary: Check if email is available
 *     description: Check if gym email or owner email is already registered
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gymEmail:
 *                 type: string
 *                 format: email
 *               ownerEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Availability check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gymEmailAvailable:
 *                   type: boolean
 *                 ownerEmailAvailable:
 *                   type: boolean
 */
router.post("/onboarding/check-availability", async (req, res) => {
  try {
    const { gymEmail, ownerEmail } = req.body;

    let gymEmailAvailable = true;
    let ownerEmailAvailable = true;

    if (gymEmail) {
      const [existing] = await db
        .select()
        .from(gymsTable)
        .where(eq(gymsTable.email, gymEmail.toLowerCase().trim()));
      gymEmailAvailable = !existing;
    }

    if (ownerEmail) {
      const [existing] = await db
        .select()
        .from(adminUsersTable)
        .where(eq(adminUsersTable.email, ownerEmail.toLowerCase().trim()));
      ownerEmailAvailable = !existing;
    }

    return res.json({
      gymEmailAvailable,
      ownerEmailAvailable,
    });
  } catch (error) {
    console.error("[AVAILABILITY CHECK ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to check availability",
    });
  }
});

/**
 * @openapi
 * /onboarding/trial-status:
 *   get:
 *     tags:
 *       - Gym Onboarding
 *     summary: Get trial status
 *     description: Get current trial status for authenticated gym
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trial status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [trial, active, suspended, cancelled]
 *                 daysRemaining:
 *                   type: integer
 *                 expiresAt:
 *                   type: string
 *                 tier:
 *                   type: string
 */
router.get("/onboarding/trial-status", async (req, res) => {
  try {
    // Get gymId from JWT token (set by auth middleware)
    const gymId = (req as any).gymId;

    if (!gymId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const [gym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.id, gymId));

    if (!gym) {
      return res.status(404).json({
        success: false,
        error: "Gym not found",
      });
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (gym.subscriptionExpiresAt) {
      const expiryDate = new Date(gym.subscriptionExpiresAt);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return res.json({
      status: gym.subscriptionStatus,
      tier: gym.subscriptionTier,
      daysRemaining: Math.max(0, daysRemaining),
      expiresAt: gym.subscriptionExpiresAt,
    });
  } catch (error) {
    console.error("[TRIAL STATUS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get trial status",
    });
  }
});

/**
 * @openapi
 * /onboarding/delete-test-account:
 *   post:
 *     tags:
 *       - Gym Onboarding
 *     summary: Delete test account (Development only)
 *     description: Delete a test gym account by owner email (only works in development)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ownerEmail
 *             properties:
 *               ownerEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       403:
 *         description: Only available in development
 */
router.post("/onboarding/delete-test-account", async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        error: "This endpoint is only available in development mode",
      });
    }

    const { ownerEmail } = req.body;

    if (!ownerEmail) {
      return res.status(400).json({
        success: false,
        error: "ownerEmail is required",
      });
    }

    // Find admin user
    const [adminUser] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, ownerEmail.toLowerCase().trim()));

    if (!adminUser) {
      return res.status(404).json({
        success: false,
        error: "No account found with this email",
      });
    }

    // Get gym info before deletion
    const [gym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.id, adminUser.gymId));

    // Delete admin user (will cascade delete related records)
    await db
      .delete(adminUsersTable)
      .where(eq(adminUsersTable.email, ownerEmail.toLowerCase().trim()));

    // Delete gym if exists
    if (gym) {
      await db.delete(gymsTable).where(eq(gymsTable.id, gym.id));
    }

    return res.json({
      success: true,
      message: "Test account deleted successfully",
      deleted: {
        owner: adminUser.name,
        email: adminUser.email,
        gym: gym?.name,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[DELETE TEST ACCOUNT ERROR]", errorMessage);
    return res.status(500).json({
      success: false,
      error: "Failed to delete test account",
      details: errorMessage,
    });
  }
});

export default router;
