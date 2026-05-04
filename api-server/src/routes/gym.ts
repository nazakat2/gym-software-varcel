import { Router } from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import {
  appAnnouncementsTable, appClassesTable, appClassBookingsTable,
  appWorkoutPlansTable, appWorkoutExercisesTable,
  appDietPlansTable, appDietMealsTable,
  appOnboardingSlidesTable,
  otpsTable,
} from "@workspace/db";
import { eq, asc, desc, and } from "drizzle-orm";

const router = Router();
const SECRET = process.env["SESSION_SECRET"] || "gym_secret_key_2026";

// ─── Email transporter ─────────────────────────────────────────────────────
const emailUser = process.env["EMAIL_USER"] || "";
const emailPass = process.env["EMAIL_PASS"] || "";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: emailUser, pass: emailPass },
});

// ─── In-memory stores ──────────────────────────────────────────────────────
const userStore = new Map<string, any>();   // userId → user data
const emailStore = new Map<string, string>(); // email → userId

function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  return local
    .split(/[._\-+]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function getOrCreateUserByEmail(email: string, extraData: any = {}): any {
  const existingId = emailStore.get(email.toLowerCase());
  if (existingId) {
    const existing = userStore.get(existingId);
    if (existing) return existing;
  }
  const id = "u_" + email.replace(/[^a-z0-9]/gi, "_");
  const newUser = {
    id,
    name: nameFromEmail(email),
    email,
    phone: "",
    membershipType: "Premium",
    membershipExpiry: "2026-12-31",
    joinDate: new Date().toISOString().split("T")[0],
    avatar: null,
    ...extraData,
  };
  userStore.set(id, newUser);
  emailStore.set(email.toLowerCase(), id);
  return newUser;
}

// Middleware: verify token
function auth(req: any, res: any, next: any) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = header.slice(7);
  // Allow demo tokens
  if (token.startsWith("demo_jwt_token_")) {
    req.userId = "u1";
    return next();
  }
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Member Auth
 *     summary: Member login
 *     description: Authenticate member with email and password, returns JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Missing credentials
 */
router.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });
  const user = getOrCreateUserByEmail(email.trim().toLowerCase());
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "30d" });
  const { avatar, ...safeUser } = user;
  return res.json({ token, user: { ...safeUser, hasAvatar: !!avatar } });
});

/**
 * @openapi
 * /auth/send-signup-otp:
 *   post:
 *     tags:
 *       - Member Auth
 *     summary: Send signup OTP
 *     description: Send verification OTP to email before creating account (expires in 10 minutes)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email already exists
 *       503:
 *         description: Email service not configured
 */
router.post("/auth/send-signup-otp", async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });

  const emailKey = email.trim().toLowerCase();
  if (emailStore.has(emailKey)) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  if (!emailUser || !emailPass) {
    return res.status(503).json({ message: "Email service not configured" });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  // Store OTP in DB (delete any old ones first)
  await db.delete(otpsTable).where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "signup")));
  await db.insert(otpsTable).values({
    email: emailKey, otp, type: "signup", expiresAt,
    data: JSON.stringify({ name: name.trim(), email: emailKey, password, phone: phone || "" }),
  });

  try {
    await transporter.sendMail({
      from: `"GymFit App" <${emailUser}>`,
      to: email,
      subject: "GymFit — Verify Your Email",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0D0D0D;color:#fff;border-radius:16px;overflow:hidden;">
          <div style="background:#E31C25;padding:32px;text-align:center;">
            <h1 style="margin:0;font-size:28px;color:#fff;">GymFit</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Email Verification</p>
          </div>
          <div style="padding:32px;text-align:center;">
            <p style="color:rgba(255,255,255,0.75);font-size:15px;margin:0 0 8px;">Hi <strong style="color:#fff;">${name.trim()}</strong>, welcome to GymFit!</p>
            <p style="color:rgba(255,255,255,0.65);font-size:14px;margin:0 0 24px;">Use this OTP to verify your email and complete signup. It expires in <strong style="color:#E31C25;">10 minutes</strong>.</p>
            <div style="background:#1A1A1A;border:2px solid #E31C25;border-radius:12px;padding:24px;display:inline-block;">
              <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#E31C25;">${otp}</span>
            </div>
            <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:24px 0 0;">If you didn't request this, ignore this email.</p>
          </div>
          <div style="background:#1A1A1A;padding:16px;text-align:center;">
            <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0;">GymFit &mdash; Your Fitness Partner</p>
          </div>
        </div>
      `,
    });
    return res.json({ message: "OTP sent to your email" });
  } catch (err: any) {
    console.error("Signup OTP email error:", err.message);
    return res.status(500).json({ message: "Failed to send verification email" });
  }
});

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags:
 *       - Member Auth
 *     summary: Create member account
 *     description: Verify OTP and create new member account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Invalid or expired OTP
 *       409:
 *         description: Email already exists
 */
router.post("/auth/signup", async (req, res) => {
  const { name, email, password, phone, otp } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });
  const emailKey = email.trim().toLowerCase();

  // If OTP provided, verify it from DB
  if (otp) {
    const [entry] = await db.select().from(otpsTable)
      .where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "signup")))
      .limit(1);
    if (!entry) return res.status(400).json({ message: "No OTP found. Please request a new one." });
    if (Date.now() > entry.expiresAt) {
      await db.delete(otpsTable).where(eq(otpsTable.id, entry.id));
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }
    if (entry.otp !== String(otp)) return res.status(400).json({ message: "Invalid OTP. Please try again." });
    await db.delete(otpsTable).where(eq(otpsTable.id, entry.id));
  }

  if (emailStore.has(emailKey)) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const id = "u_" + Date.now();
  const user = {
    id,
    name: name.trim(),
    email: emailKey,
    phone: phone || "",
    membershipType: "Basic",
    membershipExpiry: "2027-01-01",
    joinDate: new Date().toISOString().split("T")[0],
    avatar: null,
  };
  userStore.set(id, user);
  emailStore.set(emailKey, id);
  const token = jwt.sign({ id }, SECRET, { expiresIn: "30d" });
  const { avatar, ...safeUser } = user;
  return res.json({ token, user: safeUser });
});

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags:
 *       - Member Auth
 *     summary: Request password reset
 *     description: Send password reset OTP to email (expires in 15 minutes)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset code sent to email
 *       400:
 *         description: Email is required
 *       503:
 *         description: Email service not configured
 */
router.post("/auth/forgot-password", async (req: any, res: any) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  if (!emailUser || !emailPass) {
    return res.status(503).json({ message: "Email service not configured. Please contact support." });
  }

  // Generate 6-digit OTP, valid for 15 minutes — persist to DB
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const emailKey = email.trim().toLowerCase();
  await db.delete(otpsTable).where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "reset")));
  await db.insert(otpsTable).values({ email: emailKey, otp: code, type: "reset", expiresAt: Date.now() + 15 * 60 * 1000 });

  try {
    await transporter.sendMail({
      from: `"GymFit App" <${emailUser}>`,
      to: email,
      subject: "GymFit — Your Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0D0D0D; color: #fff; border-radius: 16px; overflow: hidden;">
          <div style="background: #E31C25; padding: 32px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; color: #fff;">GymFit</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Password Reset Request</p>
          </div>
          <div style="padding: 32px; text-align: center;">
            <p style="color: rgba(255,255,255,0.75); font-size: 15px; margin: 0 0 24px;">
              Use the code below to reset your password. This code expires in <strong style="color:#E31C25;">15 minutes</strong>.
            </p>
            <div style="background: #1A1A1A; border: 2px solid #E31C25; border-radius: 12px; padding: 24px; display: inline-block; margin: 0 auto;">
              <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #E31C25;">${code}</span>
            </div>
            <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 24px 0 0;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
          <div style="background: #1A1A1A; padding: 16px; text-align: center;">
            <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0;">GymFit &mdash; Your Fitness Partner</p>
          </div>
        </div>
      `,
    });
    return res.json({ message: "Reset code sent to your email" });
  } catch (err: any) {
    console.error("Email send error:", err.message);
    return res.status(500).json({ message: "Failed to send email. Check credentials or try again." });
  }
});

/**
 * @openapi
 * /auth/verify-reset-code:
 *   post:
 *     tags:
 *       - Member Auth
 *     summary: Verify password reset code
 *     description: Verify the OTP code sent to email for password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Code verified successfully
 *       400:
 *         description: Invalid or expired code
 */
router.post("/auth/verify-reset-code", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: "Email and code required" });
  const emailKey = email.trim().toLowerCase();
  const [record] = await db.select().from(otpsTable)
    .where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "reset")))
    .limit(1);
  if (!record) return res.status(400).json({ message: "Invalid or expired code" });
  if (Date.now() > record.expiresAt) {
    await db.delete(otpsTable).where(eq(otpsTable.id, record.id));
    return res.status(400).json({ message: "Code expired. Please request a new one." });
  }
  if (record.otp !== String(code)) return res.status(400).json({ message: "Invalid or expired code" });
  return res.json({ message: "Code verified" });
});

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - Member Auth
 *     summary: Reset password
 *     description: Reset password using verified OTP code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired code
 */
router.post("/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code) return res.status(400).json({ message: "Email and code required" });
  const emailKey = email.trim().toLowerCase();
  const [record] = await db.select().from(otpsTable)
    .where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "reset")))
    .limit(1);
  if (!record || record.otp !== String(code) || Date.now() > record.expiresAt) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }
  await db.delete(otpsTable).where(eq(otpsTable.id, record.id));
  return res.json({ message: "Password reset successful" });
});

// ─── Profile ───────────────────────────────────────────────────────────────
/**
 * @openapi
 * /profile:
 *   get:
 *     tags:
 *       - Member Profile
 *     summary: Get member profile
 *     description: Retrieve authenticated member's profile information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 membershipType:
 *                   type: string
 *                 membershipExpiry:
 *                   type: string
 *                 joinDate:
 *                   type: string
 *                 hasAvatar:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
router.get("/profile", auth, (req: any, res) => {
  const user = userStore.get(req.userId);
  if (!user) return res.status(404).json({ message: "Profile not found" });
  const { avatar, ...safeUser } = user;
  return res.json({ ...safeUser, hasAvatar: !!avatar });
});

/**
 * @openapi
 * /profile:
 *   put:
 *     tags:
 *       - Member Profile
 *     summary: Update member profile
 *     description: Update authenticated member's profile information
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 description: Base64 encoded avatar image
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized
 */
router.put("/profile", auth, (req: any, res) => {
  const existing = userStore.get(req.userId) || {};
  const updated = { ...existing, ...req.body, id: req.userId };
  userStore.set(req.userId, updated);
  const { avatar, ...safeUser } = updated;
  return res.json({ ...safeUser, hasAvatar: !!avatar });
});

/**
 * @openapi
 * /profile/avatar:
 *   get:
 *     tags:
 *       - Member Profile
 *     summary: Get member avatar
 *     description: Retrieve authenticated member's avatar image (base64)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 avatar:
 *                   type: string
 *                   description: Base64 encoded avatar image
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No avatar found
 */
router.get("/profile/avatar", auth, (req: any, res) => {
  const user = userStore.get(req.userId);
  if (!user?.avatar) return res.status(404).json({ message: "No avatar" });
  return res.json({ avatar: user.avatar });
});

// ─── Membership ────────────────────────────────────────────────────────────
/**
 * @openapi
 * /membership:
 *   get:
 *     tags:
 *       - Member Membership
 *     summary: Get membership details
 *     description: Retrieve authenticated member's current membership information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 type:
 *                   type: string
 *                 startDate:
 *                   type: string
 *                 endDate:
 *                   type: string
 *                 status:
 *                   type: string
 *                 features:
 *                   type: array
 *                   items:
 *                     type: string
 *                 price:
 *                   type: number
 *                 nextBillingDate:
 *                   type: string
 *                 autoRenew:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/membership", auth, (_req, res) => {
  return res.json({
    id: "m1", type: "Premium", startDate: "2026-01-01",
    endDate: "2026-12-31", status: "active",
    features: ["Unlimited gym access","2 personal training sessions/month","Group classes","Sauna"],
    price: 99.99, nextBillingDate: "2026-05-01", autoRenew: true,
  });
});

// ─── Attendance ────────────────────────────────────────────────────────────
/**
 * @openapi
 * /attendance:
 *   get:
 *     tags:
 *       - Member Attendance
 *     summary: Get attendance history
 *     description: Retrieve authenticated member's gym attendance records
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   date:
 *                     type: string
 *                   checkIn:
 *                     type: string
 *                   checkOut:
 *                     type: string
 *                   duration:
 *                     type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/attendance", auth, (_req, res) => {
  return res.json([
    { id: "a1", date: "2026-04-13", checkIn: "07:30", checkOut: "09:00", duration: 90 },
    { id: "a2", date: "2026-04-11", checkIn: "06:45", checkOut: "08:15", duration: 90 },
    { id: "a3", date: "2026-04-09", checkIn: "18:00", checkOut: "19:30", duration: 90 },
  ]);
});

/**
 * @openapi
 * /attendance/checkin:
 *   post:
 *     tags:
 *       - Member Attendance
 *     summary: Check in to gym
 *     description: Record member check-in at the gym
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Check-in successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 time:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post("/attendance/checkin", auth, (_req, res) => {
  return res.json({ message: "Checked in successfully", time: new Date().toISOString() });
});

// ─── Announcements ─────────────────────────────────────────────────────────
/**
 * @openapi
 * /announcements:
 *   get:
 *     tags:
 *       - Member Announcements
 *     summary: Get gym announcements
 *     description: Retrieve active announcements for members
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   message:
 *                     type: string
 *                   type:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/announcements", auth, async (_req, res) => {
  try {
    const rows = await db.select().from(appAnnouncementsTable)
      .where(eq(appAnnouncementsTable.isActive, true))
      .orderBy(desc(appAnnouncementsTable.createdAt));
    return res.json(rows);
  } catch { return res.json([]); }
});

// ─── Onboarding Slides ─────────────────────────────────────────────────────
/**
 * @openapi
 * /onboarding-slides:
 *   get:
 *     tags:
 *       - Member Onboarding
 *     summary: Get onboarding slides
 *     description: Retrieve active onboarding slides for new members (no auth required)
 *     responses:
 *       200:
 *         description: List of active onboarding slides
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   image:
 *                     type: string
 *                   order:
 *                     type: integer
 *                   isActive:
 *                     type: boolean
 */
router.get("/onboarding-slides", async (_req, res) => {
  try {
    const rows = await db.select().from(appOnboardingSlidesTable)
      .where(eq(appOnboardingSlidesTable.isActive, true))
      .orderBy(asc(appOnboardingSlidesTable.order));
    return res.json(rows);
  } catch { return res.json([]); }
});

// ─── Workout Plans ─────────────────────────────────────────────────────────
/**
 * @openapi
 * /workout-plans:
 *   get:
 *     tags:
 *       - Member Workout Plans
 *     summary: Get all workout plans
 *     description: Retrieve all active workout plans with exercises
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workout plans with exercises
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   difficulty:
 *                     type: string
 *                   duration:
 *                     type: string
 *                   exercises:
 *                     type: array
 *                     items:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get("/workout-plans", auth, async (_req, res) => {
  try {
    const plans = await db.select().from(appWorkoutPlansTable)
      .where(eq(appWorkoutPlansTable.isActive, true))
      .orderBy(asc(appWorkoutPlansTable.id));
    const result = await Promise.all(plans.map(async (plan) => {
      const exercises = await db.select().from(appWorkoutExercisesTable)
        .where(eq(appWorkoutExercisesTable.planId, plan.id))
        .orderBy(asc(appWorkoutExercisesTable.order));
      return { ...plan, exercises };
    }));
    return res.json(result);
  } catch { return res.json([]); }
});

/**
 * @openapi
 * /workout-plans/{id}:
 *   get:
 *     tags:
 *       - Member Workout Plans
 *     summary: Get workout plan by ID
 *     description: Retrieve a specific workout plan with all exercises
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Workout plan ID
 *     responses:
 *       200:
 *         description: Workout plan details with exercises
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 difficulty:
 *                   type: string
 *                 duration:
 *                   type: string
 *                 exercises:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Server error
 */
router.get("/workout-plans/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(appWorkoutPlansTable).where(eq(appWorkoutPlansTable.id, id));
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const exercises = await db.select().from(appWorkoutExercisesTable)
      .where(eq(appWorkoutExercisesTable.planId, id))
      .orderBy(asc(appWorkoutExercisesTable.order));
    return res.json({ ...plan, exercises });
  } catch { return res.status(500).json({ message: "Server error" }); }
});

// ─── Diet Plans ────────────────────────────────────────────────────────────
/**
 * @openapi
 * /diet-plans:
 *   get:
 *     tags:
 *       - Member Diet Plans
 *     summary: Get all diet plans
 *     description: Retrieve all active diet plans with meals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of diet plans with meals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   calories:
 *                     type: integer
 *                   protein:
 *                     type: integer
 *                   carbs:
 *                     type: integer
 *                   fats:
 *                     type: integer
 *                   meals:
 *                     type: array
 *                     items:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get("/diet-plans", auth, async (_req, res) => {
  try {
    const plans = await db.select().from(appDietPlansTable)
      .where(eq(appDietPlansTable.isActive, true))
      .orderBy(asc(appDietPlansTable.id));
    const result = await Promise.all(plans.map(async (plan) => {
      const meals = await db.select().from(appDietMealsTable)
        .where(eq(appDietMealsTable.planId, plan.id))
        .orderBy(asc(appDietMealsTable.order));
      return { ...plan, meals };
    }));
    return res.json(result);
  } catch { return res.json([]); }
});

/**
 * @openapi
 * /diet-plans/{id}:
 *   get:
 *     tags:
 *       - Member Diet Plans
 *     summary: Get diet plan by ID
 *     description: Retrieve a specific diet plan with all meals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Diet plan ID
 *     responses:
 *       200:
 *         description: Diet plan details with meals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 calories:
 *                   type: integer
 *                 protein:
 *                   type: integer
 *                 carbs:
 *                   type: integer
 *                 fats:
 *                   type: integer
 *                 meals:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Server error
 */
router.get("/diet-plans/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(appDietPlansTable).where(eq(appDietPlansTable.id, id));
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const meals = await db.select().from(appDietMealsTable)
      .where(eq(appDietMealsTable.planId, id))
      .orderBy(asc(appDietMealsTable.order));
    return res.json({ ...plan, meals });
  } catch { return res.status(500).json({ message: "Server error" }); }
});

// ─── Classes ───────────────────────────────────────────────────────────────
/**
 * @openapi
 * /classes:
 *   get:
 *     tags:
 *       - Member Classes
 *     summary: Get all available classes
 *     description: Retrieve all active gym classes with booking status for authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of classes with booking information
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   instructor:
 *                     type: string
 *                   date:
 *                     type: string
 *                   time:
 *                     type: string
 *                   duration:
 *                     type: integer
 *                   capacity:
 *                     type: integer
 *                   enrolled:
 *                     type: integer
 *                   isBooked:
 *                     type: boolean
 *                   bookingId:
 *                     type: integer
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 */
router.get("/classes", auth, async (req: any, res) => {
  try {
    const classes = await db.select().from(appClassesTable)
      .where(eq(appClassesTable.isActive, true))
      .orderBy(asc(appClassesTable.date), asc(appClassesTable.time));
    const bookings = await db.select().from(appClassBookingsTable)
      .where(eq(appClassBookingsTable.memberEmail, req.userId || ""));
    const bookedIds = new Set(bookings.filter(b => b.status === "confirmed").map(b => b.classId));
    const result = classes.map(c => ({
      ...c, isBooked: bookedIds.has(c.id),
      bookingId: bookings.find(b => b.classId === c.id && b.status === "confirmed")?.id || null,
    }));
    return res.json(result);
  } catch { return res.json([]); }
});

/**
 * @openapi
 * /classes/book:
 *   post:
 *     tags:
 *       - Member Classes
 *     summary: Book a class
 *     description: Book a gym class for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classId
 *             properties:
 *               classId:
 *                 type: integer
 *                 description: ID of the class to book
 *     responses:
 *       200:
 *         description: Class booked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 booking:
 *                   type: object
 *       400:
 *         description: Class is full
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Class not found
 *       409:
 *         description: Already booked
 *       500:
 *         description: Booking failed
 */
router.post("/classes/book", auth, async (req: any, res) => {
  try {
    const { classId } = req.body;
    const id = parseInt(classId);
    const [cls] = await db.select().from(appClassesTable).where(eq(appClassesTable.id, id));
    if (!cls) return res.status(404).json({ message: "Class not found" });
    if (cls.enrolled >= cls.capacity) return res.status(400).json({ message: "Class is full" });
    const existing = await db.select().from(appClassBookingsTable)
      .where(eq(appClassBookingsTable.classId, id));
    if (existing.some(b => b.memberEmail === req.userId && b.status === "confirmed")) {
      return res.status(409).json({ message: "Already booked" });
    }
    const [booking] = await db.insert(appClassBookingsTable).values({
      classId: id, memberEmail: req.userId, status: "confirmed",
    }).returning();
    await db.update(appClassesTable).set({ enrolled: cls.enrolled + 1 }).where(eq(appClassesTable.id, id));
    return res.json({ message: "Class booked successfully", booking });
  } catch { return res.status(500).json({ message: "Booking failed" }); }
});

/**
 * @openapi
 * /classes/bookings:
 *   get:
 *     tags:
 *       - Member Classes
 *     summary: Get member's class bookings
 *     description: Retrieve all class bookings for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of member's bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   classId:
 *                     type: integer
 *                   memberEmail:
 *                     type: string
 *                   status:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/classes/bookings", auth, async (req: any, res) => {
  try {
    const bookings = await db.select().from(appClassBookingsTable)
      .where(eq(appClassBookingsTable.memberEmail, req.userId));
    return res.json(bookings);
  } catch { return res.json([]); }
});

/**
 * @openapi
 * /classes/bookings/{id}:
 *   delete:
 *     tags:
 *       - Member Classes
 *     summary: Cancel class booking
 *     description: Cancel a class booking for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Booking ID to cancel
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Cancel failed
 */
router.delete("/classes/bookings/:id", auth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db.select().from(appClassBookingsTable).where(eq(appClassBookingsTable.id, id));
    if (booking) {
      await db.update(appClassBookingsTable).set({ status: "cancelled" }).where(eq(appClassBookingsTable.id, id));
      const [cls] = await db.select().from(appClassesTable).where(eq(appClassesTable.id, booking.classId));
      if (cls && cls.enrolled > 0) {
        await db.update(appClassesTable).set({ enrolled: cls.enrolled - 1 }).where(eq(appClassesTable.id, booking.classId));
      }
    }
    return res.json({ message: "Booking cancelled" });
  } catch { return res.status(500).json({ message: "Cancel failed" }); }
});

// ─── Notifications ─────────────────────────────────────────────────────────
/**
 * @openapi
 * /notifications:
 *   get:
 *     tags:
 *       - Member Notifications
 *     summary: Get member notifications
 *     description: Retrieve all notifications for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   type:
 *                     type: string
 *                   title:
 *                     type: string
 *                   message:
 *                     type: string
 *                   read:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/notifications", auth, (_req, res) => {
  return res.json([
    { id: "n1", type: "class", title: "Class Reminder", message: "CrossFit WOD starts in 1 hour!", read: false },
    { id: "n2", type: "payment", title: "Payment Due", message: "Your membership renewal is due in 7 days.", read: false },
  ]);
});

/**
 * @openapi
 * /notifications/{id}/read:
 *   put:
 *     tags:
 *       - Member Notifications
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 read:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 */
router.put("/notifications/:id/read", auth, (req, res) => {
  return res.json({ id: req.params.id, read: true });
});

/**
 * @openapi
 * /notifications/read-all:
 *   put:
 *     tags:
 *       - Member Notifications
 *     summary: Mark all notifications as read
 *     description: Mark all notifications as read for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.put("/notifications/read-all", auth, (_req, res) => {
  return res.json({ message: "All notifications marked as read" });
});

// ─── Progress ──────────────────────────────────────────────────────────────
/**
 * @openapi
 * /progress:
 *   get:
 *     tags:
 *       - Member Progress
 *     summary: Get progress records
 *     description: Retrieve all progress tracking records for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of progress records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   date:
 *                     type: string
 *                   weight:
 *                     type: number
 *                   bodyFat:
 *                     type: number
 *                   muscleMass:
 *                     type: number
 *                   bmi:
 *                     type: number
 *       401:
 *         description: Unauthorized
 */
router.get("/progress", auth, (_req, res) => {
  return res.json([
    { id: "p1", date: "2026-04-01", weight: 82.5, bodyFat: 18.2, muscleMass: 38.5, bmi: 24.1 },
    { id: "p2", date: "2026-03-01", weight: 83.8, bodyFat: 19.0, muscleMass: 38.0, bmi: 24.5 },
  ]);
});

/**
 * @openapi
 * /progress:
 *   post:
 *     tags:
 *       - Member Progress
 *     summary: Add progress record
 *     description: Add a new progress tracking record for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weight:
 *                 type: number
 *               bodyFat:
 *                 type: number
 *               muscleMass:
 *                 type: number
 *               bmi:
 *                 type: number
 *     responses:
 *       200:
 *         description: Progress record added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 date:
 *                   type: string
 *                 weight:
 *                   type: number
 *                 bodyFat:
 *                   type: number
 *                 muscleMass:
 *                   type: number
 *                 bmi:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
router.post("/progress", auth, (req, res) => {
  return res.json({ id: "p_" + Date.now(), ...req.body, date: new Date().toISOString().split("T")[0] });
});

// ─── Payments ──────────────────────────────────────────────────────────────
/**
 * @openapi
 * /payments:
 *   get:
 *     tags:
 *       - Member Payments
 *     summary: Get payment history
 *     description: Retrieve payment history for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   type:
 *                     type: string
 *                   description:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   date:
 *                     type: string
 *                   status:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/payments", auth, (_req, res) => {
  return res.json([
    { id: "pay1", type: "Membership", description: "Premium Membership - April 2026", amount: 99.99, date: "2026-04-01", status: "paid" },
    { id: "pay2", type: "Membership", description: "Premium Membership - March 2026", amount: 99.99, date: "2026-03-01", status: "paid" },
  ]);
});

// ─── Messages ──────────────────────────────────────────────────────────────
/**
 * @openapi
 * /messages:
 *   get:
 *     tags:
 *       - Member Messages
 *     summary: Get messages
 *     description: Retrieve message history for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   from:
 *                     type: string
 *                   text:
 *                     type: string
 *                   time:
 *                     type: string
 *                   date:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/messages", auth, (_req, res) => {
  return res.json([
    { id: "m1", from: "trainer", text: "Hey! How was the workout?", time: "10:00 AM", date: "2026-04-12" },
    { id: "m2", from: "user", text: "It was intense but great!", time: "10:15 AM", date: "2026-04-12" },
  ]);
});

/**
 * @openapi
 * /messages:
 *   post:
 *     tags:
 *       - Member Messages
 *     summary: Send message
 *     description: Send a new message from the authenticated member
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *               time:
 *                 type: string
 *               date:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 from:
 *                   type: string
 *                 text:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post("/messages", auth, (req, res) => {
  return res.json({ id: "m_" + Date.now(), from: "user", ...req.body });
});

// ─── Contact Support ────────────────────────────────────────────────────────
/**
 * @openapi
 * /support/contact:
 *   post:
 *     tags:
 *       - Member Support
 *     summary: Contact support
 *     description: Send a support message to gym staff (no auth required)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the person contacting support
 *               message:
 *                 type: string
 *                 description: Support message content
 *     responses:
 *       200:
 *         description: Support message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Name and message are required
 *       500:
 *         description: Failed to send message
 *       503:
 *         description: Email service not configured
 */
router.post("/support/contact", async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) return res.status(400).json({ message: "Name and message are required" });

  if (!emailUser || !emailPass) {
    return res.status(503).json({ message: "Email service not configured" });
  }

  try {
    await transporter.sendMail({
      from: `"GymFit Support" <${emailUser}>`,
      to: emailUser,
      subject: `GymFit Support Request from ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
          <div style="background:#E31C25;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">GymFit Support Request</h1>
          </div>
          <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #eee;">
            <p style="margin:0 0 8px;color:#555;font-size:14px;text-transform:uppercase;letter-spacing:1px;">From</p>
            <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#111;">${name}</p>
            <p style="margin:0 0 8px;color:#555;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Message</p>
            <p style="margin:0;font-size:16px;color:#333;line-height:1.6;background:#f5f5f5;padding:16px;border-radius:6px;white-space:pre-wrap;">${message}</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;text-align:center;">Sent from GymFit Mobile App • ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
    });
    return res.json({ message: "Support message sent successfully" });
  } catch (err: any) {
    console.error("Support email error:", err.message);
    return res.status(500).json({ message: "Failed to send message. Please try again." });
  }
});

export default router;
