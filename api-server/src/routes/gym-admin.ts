import { Router, Request, Response, NextFunction } from "express";

// Error handling wrapper for async routes
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res, next);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Database Error in ${req.path}:`, errorMessage);
    res.status(500).json({
      message: "Database operation failed",
      error: errorMessage
    });
  }
};
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import {
  membersTable, measurementsTable, attendanceTable, employeesTable,
  invoicesTable, suppliersTable, productsTable, salesTable,
  posOrdersTable, posOrderItemsTable,
  accountsTable, vouchersTable, adminUsersTable, adminNotificationsTable,
  businessSettingsTable,
  appAnnouncementsTable, appClassesTable, appWorkoutPlansTable, appWorkoutExercisesTable,
  appDietPlansTable, appDietMealsTable, appOnboardingSlidesTable,
  memberHealthTable, memberNotesTable, membershipHistoryTable,
  plansTable, clientSubscriptionsTable, trainerEarningsTable,
} from "@workspace/db";
import { eq, desc, asc, and, like, or, sql, gte, lte, count } from "drizzle-orm";
import { otpsTable } from "@workspace/db";

const router = Router();

// ── Email transporter ──────────────────────────────────────────────────────
const emailUser = process.env["EMAIL_USER"] || "";
const emailPass = process.env["EMAIL_PASS"] || "";
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: emailUser, pass: emailPass },
});

// ── Admin Auth ────────────────────────────────────────────────────────────
/**
 * @openapi
 * /admin/auth/login:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Admin login
 *     description: Authenticate an admin user with email and password
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
 *                 example: admin@gym.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
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
 *                       enum: [admin, staff]
 *                     status:
 *                       type: string
 *       400:
 *         description: Email and password required
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account is inactive
 */
router.post("/admin/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email.toLowerCase().trim()));
    if (!user || user.password !== password) return res.status(401).json({ message: "Invalid email or password" });
    if (user.status !== "active") return res.status(403).json({ message: "Account is inactive" });
    await db.update(adminUsersTable).set({ lastLogin: new Date().toISOString() }).where(eq(adminUsersTable.id, user.id));
    const { password: _, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LOGIN ERROR]", msg);
    return res.status(500).json({ message: msg });
  }
});

/**
 * @openapi
 * /admin/auth/me:
 *   get:
 *     tags:
 *       - Admin Auth
 *     summary: Get current admin user
 *     description: Retrieve the currently authenticated admin user's profile
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: Admin user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Not authenticated or user not found
 */
router.get("/admin/auth/me", async (req, res) => {
  const email = req.headers["x-admin-email"] as string;
  if (!email) return res.status(401).json({ message: "Not authenticated" });
  const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email));
  if (!user) return res.status(401).json({ message: "User not found" });
  const { password: _, ...safeUser } = user;
  return res.json(safeUser);
});

// POST /admin/auth/forgot-password — generate & email OTP
/**
 * @openapi
 * /admin/auth/forgot-password:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Request password reset
 *     description: Send a 6-digit OTP to the admin's email for password reset
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
 *                 example: admin@gym.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP sent to your email
 *       400:
 *         description: Email is required
 *       404:
 *         description: No account found with this email
 *       500:
 *         description: Failed to send email
 */
router.post("/admin/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const [user] = await db.select().from(adminUsersTable)
    .where(eq(adminUsersTable.email, email.toLowerCase().trim()));
  if (!user) return res.status(404).json({ message: "No account found with this email" });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const emailKey = email.toLowerCase().trim();
  await db.delete(otpsTable).where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "admin-reset")));
  await db.insert(otpsTable).values({ email: emailKey, otp, type: "admin-reset", expiresAt });

  try {
    await transporter.sendMail({
      from: `"GymAdmin" <${emailUser}>`,
      to: email,
      subject: "Password Reset OTP — GymAdmin",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px;">
          <h2 style="color:#E31C25;margin-top:0;">Password Reset</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Use the OTP below to reset your GymAdmin password. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#E31C25;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
    return res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Email error:", err);
    return res.status(500).json({ message: "Failed to send email. Check server email config." });
  }
});

// POST /admin/auth/verify-otp — check OTP is valid
/**
 * @openapi
 * /admin/auth/verify-otp:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Verify OTP
 *     description: Verify the OTP sent to admin's email for password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post("/admin/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });
  const emailKey = email.toLowerCase().trim();
  const [entry] = await db.select().from(otpsTable)
    .where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "admin-reset"))).limit(1);
  if (!entry) return res.status(400).json({ message: "No OTP found. Please request a new one." });
  if (Date.now() > entry.expiresAt) {
    await db.delete(otpsTable).where(eq(otpsTable.id, entry.id));
    return res.status(400).json({ message: "OTP has expired. Please request a new one." });
  }
  if (entry.otp !== String(otp)) return res.status(400).json({ message: "Invalid OTP" });
  return res.json({ message: "OTP verified" });
});

// POST /admin/auth/reset-password — set new password (OTP must still be valid)
/**
 * @openapi
 * /admin/auth/reset-password:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Reset password
 *     description: Set a new password using verified OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid request or OTP expired
 */
router.post("/admin/auth/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ message: "All fields are required" });
  if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
  const emailKey = email.toLowerCase().trim();
  const [entry] = await db.select().from(otpsTable)
    .where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "admin-reset"))).limit(1);
  if (!entry) return res.status(400).json({ message: "No OTP found. Please request a new one." });
  if (Date.now() > entry.expiresAt) {
    await db.delete(otpsTable).where(eq(otpsTable.id, entry.id));
    return res.status(400).json({ message: "OTP has expired. Please request a new one." });
  }
  if (entry.otp !== String(otp)) return res.status(400).json({ message: "Invalid OTP" });
  await db.update(adminUsersTable).set({ password: newPassword }).where(eq(adminUsersTable.email, emailKey));
  await db.delete(otpsTable).where(eq(otpsTable.id, entry.id));
  return res.json({ message: "Password reset successful" });
});

// POST /admin/auth/send-signup-otp — send email verification OTP for new admin account
router.post("/admin/auth/send-signup-otp", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

  const emailKey = email.toLowerCase().trim();
  const [existing] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.email, emailKey));
  if (existing) return res.status(409).json({ message: "An account with this email already exists" });

  if (!emailUser || !emailPass) return res.status(503).json({ message: "Email service not configured" });

  const validRole = role === "admin" ? "admin" : "staff";
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await db.delete(otpsTable).where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "admin-signup")));
  await db.insert(otpsTable).values({
    email: emailKey, otp, type: "admin-signup", expiresAt: Date.now() + 10 * 60 * 1000,
    data: JSON.stringify({ name: name.trim(), password, role: validRole }),
  });

  try {
    await transporter.sendMail({
      from: `"GymAdmin" <${emailUser}>`,
      to: email,
      subject: "GymAdmin — Verify Your Email",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px;">
          <h2 style="color:#E31C25;margin-top:0;">Verify Your Email</h2>
          <p>Hi <strong>${name.trim()}</strong>, welcome to GymAdmin!</p>
          <p>Use this OTP to complete your account registration. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#E31C25;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    return res.json({ message: "Verification OTP sent to your email" });
  } catch (err) {
    console.error("Signup email error:", err);
    return res.status(500).json({ message: "Failed to send verification email" });
  }
});

// POST /admin/auth/register — verify OTP and create new admin account
router.post("/admin/auth/register", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

  const emailKey = email.toLowerCase().trim();
  const [entry] = await db.select().from(otpsTable)
    .where(and(eq(otpsTable.email, emailKey), eq(otpsTable.type, "admin-signup"))).limit(1);
  if (!entry) return res.status(400).json({ message: "No OTP found. Please request a new one." });
  if (Date.now() > entry.expiresAt) {
    await db.delete(otpsTable).where(eq(otpsTable.id, entry.id));
    return res.status(400).json({ message: "OTP expired. Please request a new one." });
  }
  if (entry.otp !== String(otp)) return res.status(400).json({ message: "Invalid OTP" });

  const stored = entry.data ? JSON.parse(entry.data) : {};

  const [existing] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.email, emailKey));
  if (existing) return res.status(409).json({ message: "An account with this email already exists" });

  const defaultPermissions = stored.role === "admin"
    ? ["members", "measurements", "attendance", "employees", "billing", "pos", "inventory", "accounts", "reports", "admin-users", "notifications", "settings"]
    : ["members", "attendance"];

  const [newUser] = await db.insert(adminUsersTable).values({
    name: stored.name || "",
    email: emailKey,
    password: stored.password || "",
    role: stored.role || "staff",
    permissions: defaultPermissions,
    status: "active",
  }).returning();

  await db.delete(otpsTable).where(eq(otpsTable.id, entry.id));
  const { password: _, ...safeUser } = newUser;
  return res.status(201).json({ user: safeUser });
});

// ── Helpers ──────────────────────────────────────────────────
function calcExpiry(startDate: string, plan: string): string {
  const d = new Date(startDate);
  if (plan === "monthly") d.setMonth(d.getMonth() + 1);
  else if (plan === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (plan === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function calcBMI(weight: number, height: number): number {
  const hm = height / 100;
  return Math.round((weight / (hm * hm)) * 10) / 10;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ── Dashboard ──────────────────────────────────────────────────────────────
/**
 * @openapi
 * /dashboard/stats:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get dashboard statistics
 *     description: Returns key metrics including member counts, attendance, revenue, and inventory status
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalMembers:
 *                   type: integer
 *                   example: 150
 *                 activeMembers:
 *                   type: integer
 *                   example: 120
 *                 expiredMembers:
 *                   type: integer
 *                   example: 30
 *                 todayAttendance:
 *                   type: integer
 *                   example: 45
 *                 monthlyRevenue:
 *                   type: number
 *                   example: 125000
 *                 unpaidDues:
 *                   type: number
 *                   example: 15000
 *                 totalEmployees:
 *                   type: integer
 *                   example: 8
 *                 lowStockItems:
 *                   type: integer
 *                   example: 3
 *       500:
 *         description: Database operation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/dashboard/stats", asyncHandler(async (_req, res) => {
  const [membersAll, attending, invoicesAll, employees, products] = await Promise.all([
    db.select().from(membersTable),
    db.select().from(attendanceTable).where(eq(attendanceTable.date, today())),
    db.select().from(invoicesTable),
    db.select().from(employeesTable).where(eq(employeesTable.status, "active")),
    db.select().from(productsTable),
  ]);

  const activeMembers = membersAll.filter(m => m.status === "active").length;
  const now = today();
  const monthStart = now.slice(0, 7) + "-01";
  const monthlyRevenue = invoicesAll
    .filter(i => i.status === "paid" && i.paidDate && i.paidDate >= monthStart)
    .reduce((s, i) => s + parseFloat(i.amount as string), 0);
  const unpaidDues = invoicesAll
    .filter(i => i.status === "unpaid")
    .reduce((s, i) => s + parseFloat(i.amount as string), 0);
  const lowStockItems = products.filter(p => p.stock <= p.lowStockThreshold).length;

  res.json({
    totalMembers: membersAll.length,
    activeMembers,
    expiredMembers: membersAll.length - activeMembers,
    todayAttendance: attending.length,
    monthlyRevenue,
    unpaidDues,
    totalEmployees: employees.length,
    lowStockItems,
  });
}));

/**
 * @openapi
 * /dashboard/recent-activity:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get recent activity
 *     description: Returns the 10 most recent activities (new members, invoices, attendance)
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of recent activities
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   type:
 *                     type: string
 *                     enum: [member, invoice, attendance]
 *                   description:
 *                     type: string
 *                   time:
 *                     type: string
 *                     format: date-time
 *                   icon:
 *                     type: string
 */
router.get("/dashboard/recent-activity", async (_req, res) => {
  const [members, invoices, attendance] = await Promise.all([
    db.select().from(membersTable).orderBy(desc(membersTable.createdAt)).limit(5),
    db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt)).limit(5),
    db.select().from(attendanceTable).orderBy(desc(attendanceTable.createdAt)).limit(5),
  ]);

  const activities = [
    ...members.map(m => ({ id: m.id * 100, type: "member", description: `New member: ${m.name}`, time: m.createdAt.toISOString(), icon: "user" })),
    ...invoices.map(i => ({ id: i.id * 100 + 1, type: "invoice", description: `Invoice ${i.status === "paid" ? "paid" : "created"} — PKR ${i.amount}`, time: i.createdAt.toISOString(), icon: "receipt" })),
    ...attendance.map(a => ({ id: a.id * 100 + 2, type: "attendance", description: `Member checked in`, time: a.createdAt.toISOString(), icon: "check" })),
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 10);

  res.json(activities);
});

/**
 * @openapi
 * /dashboard/revenue-chart:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get revenue chart data
 *     description: Returns monthly revenue and expenses data for the last 6 months
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: Revenue chart data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   month:
 *                     type: string
 *                     example: "2026-04"
 *                   revenue:
 *                     type: number
 *                   expenses:
 *                     type: number
 */
router.get("/dashboard/revenue-chart", async (_req, res) => {
  const invoices = await db.select().from(invoicesTable);
  const vouchers = await db.select().from(vouchersTable);

  const months: Record<string, { revenue: number; expenses: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months[key] = { revenue: 0, expenses: 0 };
  }

  for (const inv of invoices) {
    if (inv.status === "paid" && inv.paidDate) {
      const k = inv.paidDate.slice(0, 7);
      if (months[k]) months[k].revenue += parseFloat(inv.amount as string);
    }
  }
  for (const v of vouchers) {
    const k = v.date.slice(0, 7);
    if (months[k] && v.type === "expense") months[k].expenses += parseFloat(v.amount as string);
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  res.json(Object.entries(months).map(([key, val]) => ({
    month: monthNames[parseInt(key.split("-")[1]) - 1],
    revenue: Math.round(val.revenue),
    expenses: Math.round(val.expenses),
  })));
});

/**
 * @openapi
 * /dashboard/membership-breakdown:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get membership breakdown
 *     description: Returns count of members by plan type (monthly, quarterly, yearly)
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: Membership breakdown by plan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 monthly:
 *                   type: integer
 *                 quarterly:
 *                   type: integer
 *                 yearly:
 *                   type: integer
 */
router.get("/dashboard/membership-breakdown", async (_req, res) => {
  const members = await db.select().from(membersTable);
  const counts: Record<string, number> = { monthly: 0, quarterly: 0, yearly: 0 };
  for (const m of members) {
    if (counts[m.plan] !== undefined) counts[m.plan]++;
  }
  res.json([
    { name: "Monthly", value: counts.monthly, color: "#E31C25" },
    { name: "Quarterly", value: counts.quarterly, color: "#FF6B35" },
    { name: "Yearly", value: counts.yearly, color: "#22C55E" },
  ]);
});

// ── Members ───────────────────────────────────────────────────────────────
/**
 * @openapi
 * /members:
 *   get:
 *     tags:
 *       - Members
 *     summary: Get all members
 *     description: Retrieve a list of all gym members with optional filtering by status and search
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, expired, frozen]
 *         description: Filter members by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, phone, or CNIC
 *     responses:
 *       200:
 *         description: List of members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Member'
 *       500:
 *         description: Database operation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/members", asyncHandler(async (req, res) => {
  const { status, search } = req.query as { status?: string; search?: string };
  let rows = await db.select().from(membersTable).orderBy(desc(membersTable.createdAt));

  if (status && status !== "all") rows = rows.filter(m => m.status === status);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(m =>
      m.name.toLowerCase().includes(s) ||
      m.phone.includes(s) ||
      m.cnic.includes(s)
    );
  }
  // Update status based on expiry
  const now = today();
  rows = rows.map(m => ({ ...m, status: m.planExpiryDate < now ? "expired" : "active" }));
  res.json(rows);
}));

/**
 * @openapi
 * /members:
 *   post:
 *     tags:
 *       - Members
 *     summary: Create a new member
 *     description: Register a new gym member with their details and membership plan
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - cnic
 *               - plan
 *               - planStartDate
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               whatsapp:
 *                 type: string
 *               email:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *               dob:
 *                 type: string
 *                 format: date
 *               cnic:
 *                 type: string
 *               city:
 *                 type: string
 *               area:
 *                 type: string
 *               address:
 *                 type: string
 *               bloodGroup:
 *                 type: string
 *               emergencyContactName:
 *                 type: string
 *               emergencyContactPhone:
 *                 type: string
 *               fitnessGoal:
 *                 type: string
 *               referralSource:
 *                 type: string
 *               photoUrl:
 *                 type: string
 *               plan:
 *                 type: string
 *                 enum: [monthly, quarterly, yearly]
 *               planStartDate:
 *                 type: string
 *                 format: date
 *               assignedTrainerId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Member created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 */
router.post("/members", async (req, res) => {
  const {
    name, phone, whatsapp, email, gender, dob, cnic, city, area, address, bloodGroup,
    emergencyContactName, emergencyContactPhone, fitnessGoal, referralSource,
    photoUrl, plan, planStartDate, assignedTrainerId, commissionPercent,
  } = req.body;
  const planExpiryDate = calcExpiry(planStartDate, plan);
  const [member] = await db.insert(membersTable).values({
    name, phone, whatsapp: whatsapp || null, email: email || null,
    gender: gender || "male", dob: dob || null, cnic,
    city: city || null, area: area || null, address: address || null,
    bloodGroup: bloodGroup || null,
    emergencyContactName: emergencyContactName || null,
    emergencyContactPhone: emergencyContactPhone || null,
    fitnessGoal: fitnessGoal || "general",
    referralSource: referralSource || null,
    photoUrl: photoUrl || null,
    plan, planStartDate, planExpiryDate, status: "active",
    assignedTrainerId: assignedTrainerId ? parseInt(assignedTrainerId) : null,
  }).returning();

  // Auto-create invoice
  const planPrices: Record<string, number> = { daily: 200, weekly: 800, monthly: 3000, quarterly: 8000, yearly: 28000 };
  await db.insert(invoicesTable).values({
    memberId: member.id,
    amount: String(planPrices[plan] || 3000),
    plan, dueDate: planStartDate, status: "unpaid",
  });

  // Log membership history
  await db.insert(membershipHistoryTable).values({
    memberId: member.id, plan, startDate: planStartDate, expiryDate: planExpiryDate,
    amount: String(planPrices[plan] || 3000), status: "active",
  });

  // Create trainer commission subscription if commission % provided
  if (assignedTrainerId && commissionPercent && parseFloat(commissionPercent) > 0) {
    const planNames: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
    const [commPlan] = await db.insert(plansTable).values({
      name: `${planNames[plan] || plan} - ${commissionPercent}% Commission`,
      totalFee: String(planPrices[plan] || 3000),
      commissionType: "percentage",
      commissionValue: String(commissionPercent),
      isActive: false,
    }).returning();
    await db.insert(clientSubscriptionsTable).values({
      memberId: member.id,
      trainerId: parseInt(assignedTrainerId),
      planId: commPlan.id,
      startDate: planStartDate,
      status: "active",
    });
  }

  // Create notification
  await db.insert(adminNotificationsTable).values({
    type: "new_member", title: "New Member Registered",
    message: `${name} has joined on the ${plan} plan.`, read: false,
  });

  res.status(201).json(member);
});

/**
 * @openapi
 * /members/{id}:
 *   get:
 *     tags:
 *       - Members
 *     summary: Get member by ID
 *     description: Retrieve detailed information about a specific member
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *     responses:
 *       200:
 *         description: Member details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 *       404:
 *         description: Member not found
 */
router.get("/members/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) return res.status(404).json({ message: "Member not found" });
  const now = today();
  member.status = member.planExpiryDate < now ? "expired" : "active";
  res.json(member);
});

/**
 * @openapi
 * /members/{id}:
 *   put:
 *     tags:
 *       - Members
 *     summary: Update member
 *     description: Update member information including personal details and membership plan
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *               email:
 *                 type: string
 *               plan:
 *                 type: string
 *                 enum: [monthly, quarterly, yearly]
 *               planStartDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [active, expired, frozen]
 *               frozenUntil:
 *                 type: string
 *                 format: date
 *               blacklisted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Member updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 */
router.put("/members/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const {
    name, phone, whatsapp, email, gender, dob, cnic, city, area, address, bloodGroup,
    emergencyContactName, emergencyContactPhone, fitnessGoal, referralSource,
    photoUrl, plan, planStartDate, assignedTrainerId, status, blacklisted,
  } = req.body;

  const existing = await db.select().from(membersTable).where(eq(membersTable.id, id)).limit(1);
  if (!existing[0]) return res.status(404).json({ message: "Member not found" });

  const planChanged = plan && plan !== existing[0].plan;
  const planExpiryDate = plan ? calcExpiry(planStartDate || existing[0].planStartDate, plan) : existing[0].planExpiryDate;

  const [updated] = await db.update(membersTable).set({
    ...(name && { name }), ...(phone && { phone }),
    whatsapp: whatsapp ?? existing[0].whatsapp,
    email: email ?? existing[0].email,
    gender: gender ?? existing[0].gender,
    dob: dob ?? existing[0].dob,
    ...(cnic && { cnic }),
    city: city ?? existing[0].city, area: area ?? existing[0].area,
    address: address ?? existing[0].address, bloodGroup: bloodGroup ?? existing[0].bloodGroup,
    emergencyContactName: emergencyContactName ?? existing[0].emergencyContactName,
    emergencyContactPhone: emergencyContactPhone ?? existing[0].emergencyContactPhone,
    fitnessGoal: fitnessGoal ?? existing[0].fitnessGoal,
    referralSource: referralSource ?? existing[0].referralSource,
    photoUrl: photoUrl ?? existing[0].photoUrl,
    ...(plan && { plan, planStartDate: planStartDate || existing[0].planStartDate, planExpiryDate }),
    ...(assignedTrainerId !== undefined && { assignedTrainerId: assignedTrainerId ? parseInt(assignedTrainerId) : null }),
    ...(status && { status }),
    ...(blacklisted !== undefined && { blacklisted }),
  }).where(eq(membersTable.id, id)).returning();

  // Log membership history if plan changed
  if (planChanged && plan && planStartDate) {
    const planPrices: Record<string, number> = { daily: 200, weekly: 800, monthly: 3000, quarterly: 8000, yearly: 28000 };
    await db.insert(membershipHistoryTable).values({
      memberId: id, plan, startDate: planStartDate, expiryDate: planExpiryDate,
      amount: String(planPrices[plan] || 3000), status: "active", notes: "Plan renewed/changed",
    });
  }

  res.json(updated);
});

/**
 * @openapi
 * /members/{id}:
 *   delete:
 *     tags:
 *       - Members
 *     summary: Delete member
 *     description: Permanently delete a member from the system
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member deleted successfully
 *       404:
 *         description: Member not found
 */
router.delete("/members/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(membersTable).where(eq(membersTable.id, id));
  res.json({ message: "Member deleted" });
});

// ── Member Health ──────────────────────────────────────────────────────────
router.get("/members/:id/health", async (req, res) => {
  const memberId = parseInt(req.params.id);
  const [health] = await db.select().from(memberHealthTable).where(eq(memberHealthTable.memberId, memberId));
  res.json(health || { memberId, conditions: [], allergies: "", medicalHistory: "", doctorRecommendations: "", currentMedications: "" });
});

router.put("/members/:id/health", async (req, res) => {
  const memberId = parseInt(req.params.id);
  const { conditions, allergies, medicalHistory, doctorRecommendations, currentMedications } = req.body;
  const [existing] = await db.select().from(memberHealthTable).where(eq(memberHealthTable.memberId, memberId));
  if (existing) {
    const [updated] = await db.update(memberHealthTable).set({
      conditions: conditions || [], allergies: allergies || null,
      medicalHistory: medicalHistory || null, doctorRecommendations: doctorRecommendations || null,
      currentMedications: currentMedications || null, updatedAt: new Date(),
    }).where(eq(memberHealthTable.memberId, memberId)).returning();
    return res.json(updated);
  }
  const [created] = await db.insert(memberHealthTable).values({
    memberId, conditions: conditions || [], allergies: allergies || null,
    medicalHistory: medicalHistory || null, doctorRecommendations: doctorRecommendations || null,
    currentMedications: currentMedications || null,
  }).returning();
  res.status(201).json(created);
});

// ── Member Notes ───────────────────────────────────────────────────────────
router.get("/members/:id/notes", async (req, res) => {
  const memberId = parseInt(req.params.id);
  const notes = await db.select().from(memberNotesTable)
    .where(eq(memberNotesTable.memberId, memberId))
    .orderBy(desc(memberNotesTable.createdAt));
  res.json(notes);
});

router.post("/members/:id/notes", async (req, res) => {
  const memberId = parseInt(req.params.id);
  const { note, type, createdBy } = req.body;
  const [created] = await db.insert(memberNotesTable).values({
    memberId, note, type: type || "admin", createdBy: createdBy || "Admin",
  }).returning();
  res.status(201).json(created);
});

router.delete("/members/:id/notes/:noteId", async (req, res) => {
  await db.delete(memberNotesTable).where(eq(memberNotesTable.id, parseInt(req.params.noteId)));
  res.json({ message: "Note deleted" });
});

// ── Membership History ─────────────────────────────────────────────────────
router.get("/members/:id/membership-history", async (req, res) => {
  const memberId = parseInt(req.params.id);
  const history = await db.select().from(membershipHistoryTable)
    .where(eq(membershipHistoryTable.memberId, memberId))
    .orderBy(desc(membershipHistoryTable.createdAt));
  res.json(history);
});

// ── Freeze / Unfreeze Membership ──────────────────────────────────────────
router.post("/members/:id/freeze", async (req, res) => {
  const id = parseInt(req.params.id);
  const { freezeDays } = req.body;
  const days = parseInt(freezeDays) || 7;
  const frozenUntil = new Date();
  frozenUntil.setDate(frozenUntil.getDate() + days);
  const [updated] = await db.update(membersTable)
    .set({ frozenUntil: frozenUntil.toISOString().split("T")[0], status: "frozen" })
    .where(eq(membersTable.id, id)).returning();
  res.json(updated);
});

router.post("/members/:id/unfreeze", async (req, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(membersTable)
    .set({ frozenUntil: null, status: "active" })
    .where(eq(membersTable.id, id)).returning();
  res.json(updated);
});

// ── Member-specific sub-resources ─────────────────────────────────────────
/**
 * @openapi
 * /members/{id}/attendance:
 *   get:
 *     tags:
 *       - Members
 *     summary: Get member attendance history
 *     description: Retrieve all attendance records for a specific member
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *     responses:
 *       200:
 *         description: Member's attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attendance'
 */
router.get("/members/:id/attendance", asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.id as string);
  const records = await db.select().from(attendanceTable)
    .where(eq(attendanceTable.memberId, memberId))
    .orderBy(desc(attendanceTable.date));
  res.json(records);
}));

/**
 * @openapi
 * /members/{id}/invoices:
 *   get:
 *     tags:
 *       - Members
 *     summary: Get member invoices
 *     description: Retrieve all invoices for a specific member
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *     responses:
 *       200:
 *         description: Member's invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   memberId:
 *                     type: integer
 *                   amount:
 *                     type: string
 *                   dueDate:
 *                     type: string
 *                   status:
 *                     type: string
 *                   createdAt:
 *                     type: string
 */
router.get("/members/:id/invoices", asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.id as string);
  const records = await db.select().from(invoicesTable)
    .where(eq(invoicesTable.memberId, memberId))
    .orderBy(desc(invoicesTable.createdAt));
  res.json(records);
}));

/**
 * @openapi
 * /members/{id}/measurements:
 *   get:
 *     tags:
 *       - Members
 *     summary: Get member measurements
 *     description: Retrieve all body measurement records for a specific member
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *     responses:
 *       200:
 *         description: Member's measurement history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Measurement'
 */
router.get("/members/:id/measurements", asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.id as string);
  const records = await db.select().from(measurementsTable)
    .where(eq(measurementsTable.memberId, memberId))
    .orderBy(desc(measurementsTable.date));
  res.json(records.map(r => ({
    ...r,
    weight: parseFloat(r.weight as string),
    height: parseFloat(r.height as string),
    bmi: parseFloat(r.bmi as string),
    bodyFat: r.bodyFat ? parseFloat(r.bodyFat as string) : null,
    chest: r.chest ? parseFloat(r.chest as string) : null,
    waist: r.waist ? parseFloat(r.waist as string) : null,
    arms: r.arms ? parseFloat(r.arms as string) : null,
    hips: r.hips ? parseFloat(r.hips as string) : null,
  })));
}));

// ── Measurements ──────────────────────────────────────────────────────────
router.get("/measurements", asyncHandler(async (req, res) => {
  const { memberId } = req.query as { memberId?: string };
  const measurements = await db.select({
    measurement: measurementsTable,
    memberName: membersTable.name,
    memberDob: membersTable.dob,
    memberGender: membersTable.gender,
  }).from(measurementsTable)
    .leftJoin(membersTable, eq(measurementsTable.memberId, membersTable.id))
    .where(memberId ? eq(measurementsTable.memberId, parseInt(memberId)) : undefined)
    .orderBy(desc(measurementsTable.createdAt));

  res.json(measurements.map(r => ({
    ...r.measurement,
    memberName: r.memberName ?? "Unknown",
    memberDob: r.memberDob ?? null,
    memberGender: r.memberGender ?? "male",
    weight: parseFloat(r.measurement.weight as string),
    height: parseFloat(r.measurement.height as string),
    bmi: parseFloat(r.measurement.bmi as string),
    bodyFat: r.measurement.bodyFat ? parseFloat(r.measurement.bodyFat as string) : null,
    beforePhoto: r.measurement.beforePhoto ?? null,
    afterPhoto: r.measurement.afterPhoto ?? null,
  })));
}));

/**
 * @openapi
 * /measurements:
 *   post:
 *     tags:
 *       - Measurements
 *     summary: Record body measurements
 *     description: Add new body measurement record for a member
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - weight
 *               - height
 *               - date
 *             properties:
 *               memberId:
 *                 type: integer
 *               weight:
 *                 type: number
 *                 example: 75.5
 *               height:
 *                 type: number
 *                 example: 175
 *               bodyFat:
 *                 type: number
 *                 example: 18.5
 *               chest:
 *                 type: number
 *               waist:
 *                 type: number
 *               arms:
 *                 type: number
 *               hips:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Measurement recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Measurement'
 *                 - type: object
 *                   properties:
 *                     memberName:
 *                       type: string
 */
router.post("/measurements", async (req, res) => {
  const { memberId, weight, height, bodyFat, chest, waist, arms, hips, date, notes } = req.body;
  const bmi = calcBMI(weight, height);
  const [m] = await db.insert(measurementsTable).values({
    memberId, weight: String(weight), height: String(height),
    bmi: String(bmi), bodyFat: bodyFat ? String(bodyFat) : null,
    chest: chest ? String(chest) : null, waist: waist ? String(waist) : null,
    arms: arms ? String(arms) : null, hips: hips ? String(hips) : null,
    date, notes: notes || null,
  }).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.status(201).json({
    ...m, memberName: member?.name ?? "Unknown",
    weight: parseFloat(m.weight as string), height: parseFloat(m.height as string),
    bmi: parseFloat(m.bmi as string), bodyFat: bodyFat ?? null,
    chest: chest ?? null, waist: waist ?? null, arms: arms ?? null, hips: hips ?? null,
  });
});

router.post("/upload-photo", asyncHandler(async (req, res) => {
  const { dataUrl, filename = "photo.jpg" } = req.body as { dataUrl: string; filename?: string };
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    res.status(400).json({ error: "Invalid dataUrl" });
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.json({ url: null });
    return;
  }
  const { put } = await import("@vercel/blob");
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) { res.status(400).json({ error: "Bad dataUrl format" }); return; }
  const buffer = Buffer.from(match[2], "base64");
  const blob = await put(`photos/${Date.now()}-${filename}`, buffer, {
    access: "public",
    contentType: match[1],
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  res.json({ url: blob.url });
}));

router.patch("/measurements/:id/photos", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { beforePhoto, afterPhoto } = req.body as { beforePhoto?: string | null; afterPhoto?: string | null };
  const [updated] = await db.update(measurementsTable)
    .set({
      ...(beforePhoto !== undefined ? { beforePhoto } : {}),
      ...(afterPhoto !== undefined ? { afterPhoto } : {}),
    })
    .where(eq(measurementsTable.id, id))
    .returning();
  res.json(updated);
}));

router.put("/measurements/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { weight, height, bodyFat, chest, waist, arms, hips, notes } = req.body;
  const bmi = calcBMI(weight, height);
  const [updated] = await db.update(measurementsTable)
    .set({
      weight: String(weight), height: String(height), bmi: String(bmi),
      bodyFat: bodyFat ? String(bodyFat) : null,
      chest: chest ? String(chest) : null, waist: waist ? String(waist) : null,
      arms: arms ? String(arms) : null, hips: hips ? String(hips) : null,
      notes: notes || null,
    })
    .where(eq(measurementsTable.id, id))
    .returning();
  res.json({
    ...updated,
    weight: parseFloat(updated.weight as string), height: parseFloat(updated.height as string),
    bmi: parseFloat(updated.bmi as string),
  });
}));

router.delete("/measurements/:id", async (req, res) => {
  await db.delete(measurementsTable).where(eq(measurementsTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Deleted" });
});

// ── Attendance ─────────────────────────────────────────────────────────────
/**
 * @openapi
 * /attendance:
 *   get:
 *     tags:
 *       - Attendance
 *     summary: Get all attendance records
 *     description: Retrieve attendance records with optional date filtering
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by specific date
 *     responses:
 *       200:
 *         description: List of attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Attendance'
 *                   - type: object
 *                     properties:
 *                       memberName:
 *                         type: string
 */
router.get("/attendance", async (req, res) => {
  const { date, memberId } = req.query as { date?: string; memberId?: string };
  const rows = await db.select({
    attendance: attendanceTable,
    memberName: membersTable.name,
  }).from(attendanceTable)
    .leftJoin(membersTable, eq(attendanceTable.memberId, membersTable.id))
    .where(
      and(
        date ? eq(attendanceTable.date, date) : undefined,
        memberId ? eq(attendanceTable.memberId, parseInt(memberId)) : undefined,
      )
    )
    .orderBy(desc(attendanceTable.createdAt));

  res.json(rows.map(r => ({ ...r.attendance, memberName: r.memberName ?? "Unknown" })));
});

/**
 * @openapi
 * /attendance:
 *   post:
 *     tags:
 *       - Attendance
 *     summary: Record attendance
 *     description: Check in a member for today's attendance
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - checkInTime
 *             properties:
 *               memberId:
 *                 type: integer
 *               checkInTime:
 *                 type: string
 *                 example: "09:30"
 *               checkOutTime:
 *                 type: string
 *                 example: "11:00"
 *     responses:
 *       201:
 *         description: Attendance recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 */
router.post("/attendance", async (req, res) => {
  const { memberId } = req.body;
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const checkInTime = now.toTimeString().slice(0, 5);
  const [att] = await db.insert(attendanceTable).values({ memberId, date, checkInTime }).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.status(201).json({ ...att, memberName: member?.name ?? "Unknown" });
});

/**
 * @openapi
 * /attendance/checkout:
 *   post:
 *     tags:
 *       - Attendance
 *     summary: Check out a member
 *     description: Records check-out time for today's attendance record of a member
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *             properties:
 *               memberId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Check-out recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       404:
 *         description: No check-in record found for today
 */
router.post("/attendance/checkout", asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  const date = today();
  const checkOutTime = new Date().toTimeString().slice(0, 5);
  const [att] = await db
    .update(attendanceTable)
    .set({ checkOutTime })
    .where(and(eq(attendanceTable.memberId, memberId), eq(attendanceTable.date, date)))
    .returning();
  if (!att) {
    res.status(404).json({ error: "No check-in found for today" });
    return;
  }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.json({ ...att, memberName: member?.name ?? "Unknown" });
}));

/**
 * @openapi
 * /attendance/today-stats:
 *   get:
 *     tags:
 *       - Attendance
 *     summary: Get today's attendance statistics
 *     description: Returns total attendance count and peak hour for today
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: Today's attendance statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 45
 *                 present:
 *                   type: integer
 *                   example: 45
 *                 peakHour:
 *                   type: string
 *                   example: "09:00"
 */
router.get("/attendance/today-stats", asyncHandler(async (_req, res) => {
  const t = today();
  const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.date, t));
  const hours: Record<string, number> = {};
  for (const r of rows) {
    const h = r.checkInTime.split(":")[0];
    hours[h] = (hours[h] || 0) + 1;
  }
  const peakHour = Object.entries(hours).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
  res.json({ total: rows.length, present: rows.length, peakHour: peakHour === "N/A" ? "N/A" : `${peakHour}:00` });
}));

router.get("/attendance/monthly-chart", async (_req, res) => {
  const rows = await db.select().from(attendanceTable).orderBy(attendanceTable.date);
  const byDay: Record<string, number> = {};
  for (const r of rows) {
    byDay[r.date] = (byDay[r.date] || 0) + 1;
  }
  const last30: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    last30.push({ day: key.slice(5), count: byDay[key] || 0 });
  }
  res.json(last30);
});

// ── Employees ──────────────────────────────────────────────────────────────
/**
 * @openapi
 * /employees:
 *   get:
 *     tags:
 *       - Employees
 *     summary: Get all employees
 *     description: Retrieve a list of all gym employees
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of employees
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Employee'
 */
router.get("/employees", async (_req, res) => {
  const rows = await db.select().from(employeesTable).orderBy(desc(employeesTable.createdAt));
  res.json(rows.map(e => ({
    ...e,
    assignedMembers: e.assignedMembers ?? 0,
  })));
});

/**
 * @openapi
 * /employees:
 *   post:
 *     tags:
 *       - Employees
 *     summary: Create new employee
 *     description: Add a new employee to the gym staff
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - role
 *               - phone
 *               - salary
 *               - joinDate
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [trainer, receptionist, manager]
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               salary:
 *                 type: string
 *               commission:
 *                 type: string
 *               joinDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Employee created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 */
router.post("/employees", async (req, res) => {
  const { name, role, phone, cnic, email, salary, commission, joinDate, address } = req.body;
  const [emp] = await db.insert(employeesTable).values({
    name, role, phone, cnic: cnic || null, email: email || null,
    address: address || null,
    salary: salary,
    commission: commission || 0,
    assignedMembers: 0,
    joinDate: joinDate || new Date().toISOString().split('T')[0],
    status: "active",
  }).returning();
  res.status(201).json(emp);
});

/**
 * @openapi
 * /employees/{id}:
 *   put:
 *     tags:
 *       - Employees
 *     summary: Update employee
 *     description: Update employee information
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               salary:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Employee updated successfully
 */
router.put("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, role, phone, cnic, email, salary, commission, joinDate, address } = req.body;
  const [updated] = await db.update(employeesTable).set({
    name, role, phone, cnic: cnic || null, email: email || null,
    address: address || null,
    salary: salary,
    commission: commission || 0,
    joinDate,
  }).where(eq(employeesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json(updated);
});

/**
 * @openapi
 * /employees/{id}:
 *   delete:
 *     tags:
 *       - Employees
 *     summary: Delete employee
 *     description: Remove an employee from the system
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 */
router.delete("/employees/:id", async (req, res) => {
  await db.delete(employeesTable).where(eq(employeesTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Deleted" });
});

// ── Billing ────────────────────────────────────────────────────────────────
router.get("/billing", async (req, res) => {
  const { status, memberId } = req.query as { status?: string; memberId?: string };
  const rows = await db.select({
    invoice: invoicesTable,
    memberName: membersTable.name,
  }).from(invoicesTable)
    .leftJoin(membersTable, eq(invoicesTable.memberId, membersTable.id))
    .orderBy(desc(invoicesTable.createdAt));

  let result = rows.map(r => ({
    ...r.invoice,
    memberName: r.memberName ?? "Unknown",
    amount: parseFloat(r.invoice.amount as string),
  }));
  if (status && status !== "all") result = result.filter(i => i.status === status);
  if (memberId) result = result.filter(i => i.memberId === parseInt(memberId));
  res.json(result);
});

router.post("/billing", async (req, res) => {
  const { memberId, amount, plan, dueDate } = req.body;
  const [inv] = await db.insert(invoicesTable).values({ memberId, amount: String(amount), plan, dueDate, status: "unpaid" }).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.status(201).json({ ...inv, memberName: member?.name ?? "Unknown", amount });
});

router.post("/billing/:id/pay", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { paymentMethod } = req.body;

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) return res.status(404).json({ message: "Not found" });

  const totalAmount = parseFloat(invoice.amount as string);
  let trainerCommission = 0;
  let gymRevenue = totalAmount;
  let subscriptionId: number | null = null;

  const [activeSub] = await db.select().from(clientSubscriptionsTable)
    .where(and(eq(clientSubscriptionsTable.memberId, invoice.memberId), eq(clientSubscriptionsTable.status, "active")))
    .orderBy(desc(clientSubscriptionsTable.createdAt));

  if (activeSub) {
    subscriptionId = activeSub.id;
    let commissionValue = 0;

    if (activeSub.planId) {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, activeSub.planId));
      if (plan) {
        const cv = parseFloat(plan.commissionValue as string);
        commissionValue = plan.commissionType === "percentage"
          ? totalAmount * cv / 100
          : cv;
      }
    } else {
      const [trainer] = await db.select().from(employeesTable).where(eq(employeesTable.id, activeSub.trainerId));
      if (trainer && trainer.commission) {
        commissionValue = parseFloat(trainer.commission as string);
      }
    }

    if (commissionValue > 0) {
      trainerCommission = Math.round(commissionValue * 100) / 100;
      gymRevenue = Math.round((totalAmount - trainerCommission) * 100) / 100;

      const existingEarning = await db.select().from(trainerEarningsTable).where(eq(trainerEarningsTable.sourcePaymentId, id));
      if (existingEarning.length === 0) {
        await db.insert(trainerEarningsTable).values({
          trainerId: activeSub.trainerId,
          sourcePaymentId: id,
          subscriptionId: activeSub.id,
          amount: String(trainerCommission),
          date: today(),
        });

        const [trainer] = await db.select().from(employeesTable).where(eq(employeesTable.id, activeSub.trainerId));
        if (trainer) {
          const currentEarnings = parseFloat((trainer.totalEarnings as string) || "0");
          await db.update(employeesTable)
            .set({ totalEarnings: String(currentEarnings + trainerCommission) })
            .where(eq(employeesTable.id, activeSub.trainerId));
        }
      }
    }
  }

  const [updated] = await db.update(invoicesTable).set({
    status: "paid",
    paidDate: today(),
    paymentMethod,
    subscriptionId,
    trainerCommission: String(trainerCommission),
    gymRevenue: String(gymRevenue),
  }).where(eq(invoicesTable.id, id)).returning();

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, updated.memberId));
  res.json({
    ...updated,
    memberName: member?.name ?? "Unknown",
    amount: totalAmount,
    trainerCommission,
    gymRevenue,
  });
});

router.post("/billing/:id/unpay", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) return res.status(404).json({ message: "Not found" });
  if (invoice.status !== "paid") return res.status(400).json({ message: "Invoice already unpaid" });

  const earning = await db.select().from(trainerEarningsTable).where(eq(trainerEarningsTable.sourcePaymentId, id));
  if (earning.length > 0) {
    const commissionAmount = parseFloat(earning[0].amount as string);
    const [trainer] = await db.select().from(employeesTable).where(eq(employeesTable.id, earning[0].trainerId));
    if (trainer) {
      const cur = parseFloat((trainer.totalEarnings as string) || "0");
      await db.update(employeesTable)
        .set({ totalEarnings: String(Math.max(0, cur - commissionAmount)) })
        .where(eq(employeesTable.id, earning[0].trainerId));
    }
    await db.delete(trainerEarningsTable).where(eq(trainerEarningsTable.sourcePaymentId, id));
  }

  const [updated] = await db.update(invoicesTable)
    .set({ status: "unpaid", paidDate: null, paymentMethod: null, trainerCommission: null, gymRevenue: null })
    .where(eq(invoicesTable.id, id)).returning();

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, updated.memberId));
  res.json({ ...updated, memberName: member?.name ?? "Unknown", amount: parseFloat(updated.amount as string) });
}));

router.get("/billing/dues-summary", async (_req, res) => {
  const invoices = await db.select().from(invoicesTable);
  const now = today();
  const monthStart = now.slice(0, 7) + "-01";
  const totalDues = invoices.filter(i => i.status === "unpaid").reduce((s, i) => s + parseFloat(i.amount as string), 0);
  const paidThisMonth = invoices.filter(i => i.status === "paid" && i.paidDate && i.paidDate >= monthStart).reduce((s, i) => s + parseFloat(i.amount as string), 0);
  res.json({ totalDues, totalInvoices: invoices.length, unpaidCount: invoices.filter(i => i.status === "unpaid").length, paidThisMonth });
});

// ── Products ───────────────────────────────────────────────────────────────
/**
 * @openapi
 * /products:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get all products
 *     description: Retrieve list of all gym products/supplements with supplier information
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of products
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
 *                   category:
 *                     type: string
 *                   price:
 *                     type: string
 *                   stock:
 *                     type: integer
 *                   lowStockThreshold:
 *                     type: integer
 *                   supplierName:
 *                     type: string
 */
router.get("/products", async (_req, res) => {
  const rows = await db.select({
    product: productsTable,
    supplierName: suppliersTable.name,
  }).from(productsTable)
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .orderBy(desc(productsTable.createdAt));

  res.json(rows.map(r => ({
    ...r.product,
    supplierName: r.supplierName ?? null,
    price: parseFloat(r.product.price as string),
  })));
});

/**
 * @openapi
 * /products:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Add new product
 *     description: Add a new product to inventory
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               price:
 *                 type: string
 *               stock:
 *                 type: integer
 *               lowStockThreshold:
 *                 type: integer
 *               supplierId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post("/products", async (req, res) => {
  const { name, category, price, stock, supplierId, lowStockThreshold } = req.body;
  const [prod] = await db.insert(productsTable).values({
    name, category, price: String(price), stock, supplierId: supplierId || null, lowStockThreshold,
  }).returning();
  res.status(201).json({ ...prod, price });
});

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Update product
 *     description: Update product information and stock levels
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               price:
 *                 type: string
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.put("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, category, price, stock, supplierId, lowStockThreshold } = req.body;
  const [updated] = await db.update(productsTable).set({ name, category, price: String(price), stock, supplierId: supplierId || null, lowStockThreshold }).where(eq(productsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json({ ...updated, price });
});

/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     tags:
 *       - Inventory
 *     summary: Delete product
 *     description: Remove a product from inventory
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted successfully
 */
router.delete("/products/:id", async (req, res) => {
  await db.delete(productsTable).where(eq(productsTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Deleted" });
});

// ── Sales ──────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /sales:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get all sales
 *     description: Retrieve sales history with product and member information
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of sales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   productId:
 *                     type: integer
 *                   productName:
 *                     type: string
 *                   memberId:
 *                     type: integer
 *                   memberName:
 *                     type: string
 *                   quantity:
 *                     type: integer
 *                   totalPrice:
 *                     type: string
 *                   saleDate:
 *                     type: string
 *                     format: date
 */
router.get("/sales", async (_req, res) => {
  const rows = await db.select({
    sale: salesTable,
    productName: productsTable.name,
  }).from(salesTable)
    .leftJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .orderBy(desc(salesTable.createdAt));

  res.json(rows.map(r => ({
    ...r.sale,
    productName: r.productName ?? "Unknown",
    totalAmount: parseFloat(r.sale.totalAmount as string),
  })));
});

/**
 * @openapi
 * /sales:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Record a sale
 *     description: Record a product sale and update inventory
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - totalPrice
 *               - saleDate
 *             properties:
 *               productId:
 *                 type: integer
 *               memberId:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *               totalPrice:
 *                 type: string
 *               saleDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Sale recorded successfully
 */
router.post("/sales", async (req, res) => {
  const { productId, quantity, status, customerName } = req.body;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return res.status(404).json({ message: "Product not found" });
  const totalAmount = parseFloat(product.price as string) * quantity;
  const date = today();
  const [sale] = await db.insert(salesTable).values({
    productId, quantity, totalAmount: String(totalAmount), status, customerName: customerName || null, date,
  }).returning();
  // Deduct stock
  await db.update(productsTable).set({ stock: product.stock - quantity }).where(eq(productsTable.id, productId));
  res.status(201).json({ ...sale, productName: product.name, totalAmount });
});

// ── POS Orders ─────────────────────────────────────────────────────────────

router.get("/pos/products", async (_req, res) => {
  const rows = await db.select().from(productsTable).where(sql`${productsTable.stock} > 0`).orderBy(productsTable.name);
  res.json(rows.map(r => ({ ...r, price: parseFloat(r.price as string) })));
});

router.get("/pos/products/low-stock", async (_req, res) => {
  const rows = await db.select().from(productsTable).where(sql`${productsTable.stock} <= ${productsTable.lowStockThreshold}`).orderBy(productsTable.stock);
  res.json(rows.map(r => ({ ...r, price: parseFloat(r.price as string) })));
});

/**
 * @openapi
 * /pos/orders:
 *   get:
 *     tags:
 *       - POS
 *     summary: Get POS orders
 *     description: Retrieve all point-of-sale orders with optional date filtering
 *     security:
 *       - adminEmail: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by order date
 *     responses:
 *       200:
 *         description: List of POS orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   orderNumber:
 *                     type: string
 *                   memberId:
 *                     type: integer
 *                   memberName:
 *                     type: string
 *                   totalAmount:
 *                     type: string
 *                   status:
 *                     type: string
 *                   orderDate:
 *                     type: string
 *                     format: date-time
 */
router.get("/pos/orders", async (req, res) => {
  const { date, status, memberId } = req.query as Record<string, string>;

  const orders = await db.select({
    order: posOrdersTable,
    memberName: membersTable.name,
  }).from(posOrdersTable)
    .leftJoin(membersTable, eq(posOrdersTable.memberId, membersTable.id))
    .orderBy(desc(posOrdersTable.createdAt));

  let filtered = orders;
  if (date) filtered = filtered.filter(r => r.order.date === date);
  if (status && status !== "all") filtered = filtered.filter(r => r.order.status === status);
  if (memberId) filtered = filtered.filter(r => r.order.memberId === parseInt(memberId));

  const orderIds = filtered.map(r => r.order.id);
  const allItems = orderIds.length > 0
    ? await db.select().from(posOrderItemsTable).where(sql`${posOrderItemsTable.orderId} = ANY(ARRAY[${sql.raw(orderIds.join(","))}]::int[])`)
    : [];

  const itemsByOrder = new Map<number, typeof allItems>();
  allItems.forEach(item => {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  });

  res.json(filtered.map(r => ({
    ...r.order,
    memberName: r.memberName ?? null,
    subtotal: parseFloat(r.order.subtotal as string),
    totalAmount: parseFloat(r.order.totalAmount as string),
    paidAmount: parseFloat(r.order.paidAmount as string),
    dueAmount: parseFloat(r.order.dueAmount as string),
    discount: parseFloat(r.order.discount as string),
    items: (itemsByOrder.get(r.order.id) || []).map(i => ({
      ...i,
      unitPrice: parseFloat(i.unitPrice as string),
      subtotal: parseFloat(i.subtotal as string),
    })),
  })));
});

router.get("/pos/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [row] = await db.select({ order: posOrdersTable, memberName: membersTable.name })
    .from(posOrdersTable)
    .leftJoin(membersTable, eq(posOrdersTable.memberId, membersTable.id))
    .where(eq(posOrdersTable.id, id));
  if (!row) return res.status(404).json({ message: "Order not found" });

  const items = await db.select().from(posOrderItemsTable).where(eq(posOrderItemsTable.orderId, id));
  res.json({
    ...row.order,
    memberName: row.memberName ?? null,
    subtotal: parseFloat(row.order.subtotal as string),
    totalAmount: parseFloat(row.order.totalAmount as string),
    paidAmount: parseFloat(row.order.paidAmount as string),
    dueAmount: parseFloat(row.order.dueAmount as string),
    discount: parseFloat(row.order.discount as string),
    items: items.map(i => ({ ...i, unitPrice: parseFloat(i.unitPrice as string), subtotal: parseFloat(i.subtotal as string) })),
  });
});

/**
 * @openapi
 * /pos/orders:
 *   post:
 *     tags:
 *       - POS
 *     summary: Create POS order
 *     description: Create a new point-of-sale order with items
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - totalAmount
 *             properties:
 *               memberId:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     quantity:
 *                       type: integer
 *                     price:
 *                       type: string
 *               totalAmount:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, upi]
 *     responses:
 *       201:
 *         description: Order created successfully
 */
router.post("/pos/orders", async (req, res) => {
  const { memberId, customerName, items, discount, discountType, paymentMethod, paidAmount, notes } = req.body;

  if (!items || items.length === 0) return res.status(400).json({ message: "Cart is empty" });

  // Calculate subtotal from items
  let subtotal = 0;
  const enrichedItems: { productId: number; productName: string; unitPrice: number; quantity: number; subtotal: number }[] = [];

  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) return res.status(404).json({ message: `Product #${item.productId} not found` });
    if (product.stock < item.quantity) return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
    const unitPrice = parseFloat(product.price as string);
    const lineSubtotal = unitPrice * item.quantity;
    subtotal += lineSubtotal;
    enrichedItems.push({ productId: product.id, productName: product.name, unitPrice, quantity: item.quantity, subtotal: lineSubtotal });
  }

  const discountAmt = discountType === "percent" ? (subtotal * (parseFloat(discount || "0") / 100)) : parseFloat(discount || "0");
  const totalAmount = Math.max(0, subtotal - discountAmt);
  const paid = Math.min(parseFloat(paidAmount || String(totalAmount)), totalAmount);
  const due = totalAmount - paid;
  const status = due <= 0 ? "paid" : paid === 0 ? "unpaid" : "partial";
  const date = today();

  const [order] = await db.insert(posOrdersTable).values({
    memberId: memberId || null,
    customerName: customerName || null,
    discount: String(discountAmt.toFixed(2)),
    discountType: discountType || "fixed",
    subtotal: String(subtotal.toFixed(2)),
    totalAmount: String(totalAmount.toFixed(2)),
    paidAmount: String(paid.toFixed(2)),
    dueAmount: String(due.toFixed(2)),
    paymentMethod: paymentMethod || "cash",
    status,
    notes: notes || null,
    date,
  }).returning();

  // Insert items
  await db.insert(posOrderItemsTable).values(enrichedItems.map(i => ({
    orderId: order.id,
    productId: i.productId,
    productName: i.productName,
    unitPrice: String(i.unitPrice.toFixed(2)),
    quantity: i.quantity,
    subtotal: String(i.subtotal.toFixed(2)),
  })));

  // Deduct stock
  for (const item of enrichedItems) {
    const [p] = await db.select({ stock: productsTable.stock }).from(productsTable).where(eq(productsTable.id, item.productId));
    await db.update(productsTable).set({ stock: p.stock - item.quantity }).where(eq(productsTable.id, item.productId));
  }

  res.status(201).json({ ...order, items: enrichedItems, totalAmount, subtotal, paidAmount: paid, dueAmount: due });
});

router.put("/pos/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { paidAmount, notes } = req.body;
  const [existing] = await db.select().from(posOrdersTable).where(eq(posOrdersTable.id, id));
  if (!existing) return res.status(404).json({ message: "Order not found" });

  const totalAmount = parseFloat(existing.totalAmount as string);
  const paid = Math.min(parseFloat(paidAmount), totalAmount);
  const due = totalAmount - paid;
  const status = due <= 0 ? "paid" : paid === 0 ? "unpaid" : "partial";

  const [updated] = await db.update(posOrdersTable)
    .set({ paidAmount: String(paid.toFixed(2)), dueAmount: String(due.toFixed(2)), status, notes: notes ?? existing.notes })
    .where(eq(posOrdersTable.id, id))
    .returning();
  res.json(updated);
});

router.post("/pos/orders/:id/return", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { itemId, returnQty } = req.body;
  const [item] = await db.select().from(posOrderItemsTable).where(and(eq(posOrderItemsTable.id, itemId), eq(posOrderItemsTable.orderId, id)));
  if (!item) return res.status(404).json({ message: "Item not found" });
  const canReturn = item.quantity - item.returned;
  if (returnQty > canReturn) return res.status(400).json({ message: `Can only return up to ${canReturn} units` });
  await db.update(posOrderItemsTable).set({ returned: item.returned + returnQty }).where(eq(posOrderItemsTable.id, itemId));
  if (item.productId) {
    const [p] = await db.select({ stock: productsTable.stock }).from(productsTable).where(eq(productsTable.id, item.productId));
    await db.update(productsTable).set({ stock: p.stock + returnQty }).where(eq(productsTable.id, item.productId));
  }
  res.json({ message: "Return processed" });
});

router.get("/pos/summary", async (req, res) => {
  const { date } = req.query as Record<string, string>;
  const targetDate = date || today();
  const orders = await db.select().from(posOrdersTable).where(eq(posOrdersTable.date, targetDate));
  const total = orders.reduce((s, o) => s + parseFloat(o.totalAmount as string), 0);
  const paid = orders.reduce((s, o) => s + parseFloat(o.paidAmount as string), 0);
  const due = orders.reduce((s, o) => s + parseFloat(o.dueAmount as string), 0);
  const cashTotal = orders.filter(o => o.paymentMethod === "cash").reduce((s, o) => s + parseFloat(o.paidAmount as string), 0);
  const onlineTotal = paid - cashTotal;
  const lowStock = await db.select().from(productsTable).where(sql`${productsTable.stock} <= ${productsTable.lowStockThreshold}`);
  res.json({ date: targetDate, totalSales: orders.length, totalAmount: total, paidAmount: paid, dueAmount: due, cashTotal, onlineTotal, lowStockCount: lowStock.length });
});

router.get("/pos/members", async (_req, res) => {
  const members = await db.select({ id: membersTable.id, name: membersTable.name, phone: membersTable.phone }).from(membersTable).where(eq(membersTable.status, "active")).orderBy(membersTable.name);
  res.json(members);
});

// ── Suppliers ──────────────────────────────────────────────────────────────
/**
 * @openapi
 * /suppliers:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get all suppliers
 *     description: Retrieve list of all product suppliers
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of suppliers
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
 *                   contact:
 *                     type: string
 *                   email:
 *                     type: string
 *                   address:
 *                     type: string
 */
router.get("/suppliers", async (_req, res) => {
  const suppliers = await db.select().from(suppliersTable).orderBy(desc(suppliersTable.createdAt));
  const products = await db.select().from(productsTable);
  res.json(suppliers.map(s => ({
    ...s,
    productsCount: products.filter(p => p.supplierId === s.id).length,
  })));
});

/**
 * @openapi
 * /suppliers:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Add new supplier
 *     description: Register a new product supplier
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - contact
 *             properties:
 *               name:
 *                 type: string
 *               contact:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Supplier created successfully
 */
router.post("/suppliers", async (req, res) => {
  const { name, contact, email, address } = req.body;
  const [sup] = await db.insert(suppliersTable).values({ name, contact, email: email || null, address: address || null }).returning();
  res.status(201).json({ ...sup, productsCount: 0 });
});

router.put("/suppliers/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, contact, email, address } = req.body;
  const [updated] = await db.update(suppliersTable).set({ name, contact, email: email || null, address: address || null }).where(eq(suppliersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json({ ...updated, productsCount: 0 });
});

router.delete("/suppliers/:id", async (req, res) => {
  await db.delete(suppliersTable).where(eq(suppliersTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Deleted" });
});

// ── Accounts ───────────────────────────────────────────────────────────────
/**
 * @openapi
 * /accounts:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Get all accounts
 *     description: Retrieve list of all financial accounts
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of accounts
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
 *                   type:
 *                     type: string
 *                   balance:
 *                     type: string
 */
router.get("/accounts", async (_req, res) => {
  const rows = await db.select().from(accountsTable).orderBy(accountsTable.name);
  res.json(rows.map(r => ({ ...r, balance: parseFloat(r.balance as string) })));
});

/**
 * @openapi
 * /vouchers:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Get all vouchers
 *     description: Retrieve list of all financial vouchers (income/expense)
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of vouchers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   type:
 *                     type: string
 *                     enum: [income, expense]
 *                   amount:
 *                     type: string
 *                   description:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date
 *                   accountId:
 *                     type: integer
 */
router.get("/vouchers", async (_req, res) => {
  const rows = await db.select({
    voucher: vouchersTable,
    accountName: accountsTable.name,
  }).from(vouchersTable)
    .leftJoin(accountsTable, eq(vouchersTable.accountId, accountsTable.id))
    .orderBy(desc(vouchersTable.createdAt));

  res.json(rows.map(r => ({
    ...r.voucher,
    accountName: r.accountName ?? "Unknown",
    amount: parseFloat(r.voucher.amount as string),
  })));
});

/**
 * @openapi
 * /vouchers:
 *   post:
 *     tags:
 *       - Accounts
 *     summary: Create voucher
 *     description: Record a new income or expense voucher
 *     security:
 *       - adminEmail: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - date
 *               - accountId
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               amount:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               accountId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Voucher created successfully
 */
router.post("/vouchers", async (req, res) => {
  const { accountId, type, amount, description, date } = req.body;
  const [v] = await db.insert(vouchersTable).values({ accountId, type, amount: String(amount), description, date }).returning();
  // Update account balance
  const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (acc) {
    const balance = parseFloat(acc.balance as string);
    const newBalance = type === "income" ? balance + amount : balance - amount;
    await db.update(accountsTable).set({ balance: String(newBalance) }).where(eq(accountsTable.id, accountId));
  }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  res.status(201).json({ ...v, accountName: account?.name ?? "Unknown", amount });
});

// ── Admin Users ────────────────────────────────────────────────────────────
router.get("/admin/users", async (_req, res) => {
  const rows = await db.select().from(adminUsersTable).orderBy(desc(adminUsersTable.createdAt));
  res.json(rows);
});

router.post("/admin/users", async (req, res) => {
  const { name, email, role, permissions, status } = req.body;
  const [user] = await db.insert(adminUsersTable).values({ name, email, role, permissions: permissions || [], status }).returning();
  res.status(201).json(user);
});

router.put("/admin/users/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, email, role, permissions, status } = req.body;
  const [updated] = await db.update(adminUsersTable).set({ name, email, role, permissions: permissions || [], status }).where(eq(adminUsersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json(updated);
});

router.delete("/admin/users/:id", async (req, res) => {
  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Deleted" });
});

// ── Notifications ──────────────────────────────────────────────────────────
router.get("/notifications", async (_req, res) => {
  const rows = await db.select().from(adminNotificationsTable).orderBy(desc(adminNotificationsTable.createdAt)).limit(50);
  res.json(rows);
});

router.post("/notifications/:id/read", async (req, res) => {
  await db.update(adminNotificationsTable).set({ read: true }).where(eq(adminNotificationsTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Marked as read" });
});

// ── Business Settings ──────────────────────────────────────────────────────
router.get("/business", async (_req, res) => {
  const [settings] = await db.select().from(businessSettingsTable).limit(1);
  if (!settings) {
    const [created] = await db.insert(businessSettingsTable).values({
      gymName: "GymFit Pro", address: "123 Main Street, Karachi", phone: "+92-300-1234567",
      email: "admin@gymfitpro.com", currency: "PKR", timezone: "Asia/Karachi",
    }).returning();
    return res.json(created);
  }
  res.json(settings);
});

router.put("/business", async (req, res) => {
  const { gymName, address, phone, email, logoUrl, currency, timezone, dailyFee, weeklyFee, monthlyFee, quarterlyFee, yearlyFee } = req.body;
  const [existing] = await db.select().from(businessSettingsTable).limit(1);
  const feeFields = {
    ...(dailyFee !== undefined && { dailyFee: String(dailyFee) }),
    ...(weeklyFee !== undefined && { weeklyFee: String(weeklyFee) }),
    ...(monthlyFee !== undefined && { monthlyFee: String(monthlyFee) }),
    ...(quarterlyFee !== undefined && { quarterlyFee: String(quarterlyFee) }),
    ...(yearlyFee !== undefined && { yearlyFee: String(yearlyFee) }),
  };
  if (existing) {
    const [updated] = await db.update(businessSettingsTable).set({ gymName, address, phone, email, logoUrl: logoUrl || null, currency, timezone, ...feeFields, updatedAt: new Date() }).where(eq(businessSettingsTable.id, existing.id)).returning();
    return res.json(updated);
  }
  const [created] = await db.insert(businessSettingsTable).values({ gymName, address, phone, email, logoUrl: logoUrl || null, currency, timezone, ...feeFields }).returning();
  res.json(created);
});

// ── Reports ────────────────────────────────────────────────────────────────
router.get("/reports/financial", async (req, res) => {
  const month = (req.query.month as string) || today().slice(0, 7);
  const monthStart = month + "-01";
  const monthEnd = month + "-31";

  const invoices = await db.select().from(invoicesTable);
  const vouchers = await db.select().from(vouchersTable);

  const membershipIncome = invoices
    .filter(i => i.status === "paid" && i.paidDate && i.paidDate >= monthStart && i.paidDate <= monthEnd)
    .reduce((s, i) => s + parseFloat(i.amount as string), 0);

  const sales = await db.select().from(salesTable);
  const salesIncome = sales
    .filter(s => s.status === "paid" && s.date >= monthStart && s.date <= monthEnd)
    .reduce((s, i) => s + parseFloat(i.totalAmount as string), 0);

  const totalExpenses = vouchers
    .filter(v => v.type === "expense" && v.date >= monthStart && v.date <= monthEnd)
    .reduce((s, v) => s + parseFloat(v.amount as string), 0);

  const totalRevenue = membershipIncome + salesIncome;

  // Build weekly breakdown
  const breakdown = [];
  for (let w = 1; w <= 4; w++) {
    const weekStart = `${month}-${String((w - 1) * 7 + 1).padStart(2, "0")}`;
    const weekEnd = `${month}-${String(w * 7).padStart(2, "0")}`;
    const rev = invoices
      .filter(i => i.status === "paid" && i.paidDate && i.paidDate >= weekStart && i.paidDate <= weekEnd)
      .reduce((s, i) => s + parseFloat(i.amount as string), 0);
    const exp = vouchers
      .filter(v => v.type === "expense" && v.date >= weekStart && v.date <= weekEnd)
      .reduce((s, v) => s + parseFloat(v.amount as string), 0);
    breakdown.push({ month: `Week ${w}`, revenue: Math.round(rev), expenses: Math.round(exp) });
  }

  res.json({ month, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, membershipIncome, salesIncome, breakdown });
});

router.get("/reports/attendance", async (req, res) => {
  const month = (req.query.month as string) || today().slice(0, 7);
  const rows = await db.select().from(attendanceTable).where(
    and(gte(attendanceTable.date, month + "-01"), lte(attendanceTable.date, month + "-31"))
  );

  const uniqueMembers = new Set(rows.map(r => r.memberId)).size;
  const byDay: Record<string, number> = {};
  for (const r of rows) byDay[r.date] = (byDay[r.date] || 0) + 1;
  const counts = Object.values(byDay);
  const avgDailyVisits = counts.length ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0;
  const peakDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

  const chart = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day: day.slice(5), count }));

  res.json({ month, totalVisits: rows.length, uniqueMembers, avgDailyVisits, peakDay, chart });
});

router.get("/reports/members", async (_req, res) => {
  const members = await db.select().from(membersTable);
  const now = today();
  const monthStart = now.slice(0, 7) + "-01";
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const newThisMonth = members.filter(m => m.createdAt.toISOString().slice(0, 10) >= monthStart).length;
  const expiringThisWeek = members.filter(m => m.planExpiryDate >= now && m.planExpiryDate <= weekEndStr).length;

  const byPlan: Record<string, number> = { monthly: 0, quarterly: 0, yearly: 0 };
  for (const m of members) if (byPlan[m.plan] !== undefined) byPlan[m.plan]++;

  res.json({
    totalMembers: members.length,
    newThisMonth,
    renewalsThisMonth: 0,
    expiringThisWeek,
    byPlan: [
      { name: "Monthly", value: byPlan.monthly, color: "#E31C25" },
      { name: "Quarterly", value: byPlan.quarterly, color: "#FF6B35" },
      { name: "Yearly", value: byPlan.yearly, color: "#22C55E" },
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CONTENT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// ── Announcements ──────────────────────────────────────────────────────────
router.get("/app-content/announcements", async (_req, res) => {
  const rows = await db.select().from(appAnnouncementsTable).orderBy(desc(appAnnouncementsTable.createdAt));
  res.json(rows);
});

router.post("/app-content/announcements", async (req, res) => {
  const { title, body, type } = req.body;
  if (!title || !body) return res.status(400).json({ message: "Title and body required" });
  const [row] = await db.insert(appAnnouncementsTable).values({ title, body, type: type || "info" }).returning();
  res.json(row);
});

router.put("/app-content/announcements/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { title, body, type, isActive } = req.body;
  const [row] = await db.update(appAnnouncementsTable)
    .set({ ...(title !== undefined && { title }), ...(body !== undefined && { body }), ...(type !== undefined && { type }), ...(isActive !== undefined && { isActive }) })
    .where(eq(appAnnouncementsTable.id, id)).returning();
  res.json(row);
});

router.delete("/app-content/announcements/:id", async (req, res) => {
  await db.delete(appAnnouncementsTable).where(eq(appAnnouncementsTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Deleted" });
});

// ── Classes ───────────────────────────────────────────────────────────────
/**
 * @openapi
 * /app-content/classes:
 *   get:
 *     tags:
 *       - App Content
 *     summary: Get all gym classes
 *     description: Retrieve all gym classes/sessions for the mobile app
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of gym classes
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
 *                   schedule:
 *                     type: string
 *                   duration:
 *                     type: integer
 *                   capacity:
 *                     type: integer
 *                   description:
 *                     type: string
 */
router.get("/app-content/classes", async (_req, res) => {
  const rows = await db.select().from(appClassesTable).orderBy(asc(appClassesTable.date), asc(appClassesTable.time));
  res.json(rows);
});

router.post("/app-content/classes", async (req, res) => {
  const { name, category, instructor, time, date, duration, capacity, location, level } = req.body;
  if (!name || !instructor || !time || !date) return res.status(400).json({ message: "Missing required fields" });
  const [row] = await db.insert(appClassesTable).values({
    name, category: category || "Other", instructor, time, date,
    duration: duration || 60, capacity: capacity || 20, enrolled: 0,
    location: location || "Main Floor", level: level || "All levels",
  }).returning();
  res.json(row);
});

router.put("/app-content/classes/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, category, instructor, time, date, duration, capacity, location, level, isActive } = req.body;
  const [row] = await db.update(appClassesTable).set({
    ...(name !== undefined && { name }), ...(category !== undefined && { category }),
    ...(instructor !== undefined && { instructor }), ...(time !== undefined && { time }),
    ...(date !== undefined && { date }), ...(duration !== undefined && { duration }),
    ...(capacity !== undefined && { capacity }), ...(location !== undefined && { location }),
    ...(level !== undefined && { level }), ...(isActive !== undefined && { isActive }),
  }).where(eq(appClassesTable.id, id)).returning();
  res.json(row);
});

router.delete("/app-content/classes/:id", async (req, res) => {
  await db.delete(appClassesTable).where(eq(appClassesTable.id, parseInt(req.params.id as string)));
  res.json({ message: "Deleted" });
});

// ── Workout Plans ──────────────────────────────────────────────────────────
/**
 * @openapi
 * /app-content/workout-plans:
 *   get:
 *     tags:
 *       - App Content
 *     summary: Get all workout plans
 *     description: Retrieve all workout plans with exercises for the mobile app
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of workout plans
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
 *                   level:
 *                     type: string
 *                     enum: [beginner, intermediate, advanced]
 *                   duration:
 *                     type: string
 *                   exercises:
 *                     type: array
 *                     items:
 *                       type: object
 */
router.get("/app-content/workout-plans", async (_req, res) => {
  const plans = await db.select().from(appWorkoutPlansTable).orderBy(asc(appWorkoutPlansTable.id));
  const result = await Promise.all(plans.map(async (p) => {
    const exercises = await db.select().from(appWorkoutExercisesTable)
      .where(eq(appWorkoutExercisesTable.planId, p.id)).orderBy(asc(appWorkoutExercisesTable.order));
    return { ...p, exercises };
  }));
  res.json(result);
});

router.post("/app-content/workout-plans", async (req, res) => {
  const { name, goal, level, duration, daysPerWeek, trainer, exercises } = req.body;
  if (!name) return res.status(400).json({ message: "Plan name required" });
  const [plan] = await db.insert(appWorkoutPlansTable).values({
    name, goal: goal || "General fitness", level: level || "Beginner",
    duration: duration || "4 weeks", daysPerWeek: daysPerWeek || 3,
    trainer: trainer || "",
  }).returning();
  if (exercises && Array.isArray(exercises)) {
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      await db.insert(appWorkoutExercisesTable).values({
        planId: plan.id, name: ex.name, sets: ex.sets || 3, reps: ex.reps || "10", rest: ex.rest || "60s", order: i + 1,
      });
    }
  }
  const exRows = await db.select().from(appWorkoutExercisesTable).where(eq(appWorkoutExercisesTable.planId, plan.id)).orderBy(asc(appWorkoutExercisesTable.order));
  res.json({ ...plan, exercises: exRows });
});

router.put("/app-content/workout-plans/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, goal, level, duration, daysPerWeek, trainer, isActive, exercises } = req.body;
  const [plan] = await db.update(appWorkoutPlansTable).set({
    ...(name !== undefined && { name }), ...(goal !== undefined && { goal }),
    ...(level !== undefined && { level }), ...(duration !== undefined && { duration }),
    ...(daysPerWeek !== undefined && { daysPerWeek }), ...(trainer !== undefined && { trainer }),
    ...(isActive !== undefined && { isActive }),
  }).where(eq(appWorkoutPlansTable.id, id)).returning();
  if (exercises && Array.isArray(exercises)) {
    await db.delete(appWorkoutExercisesTable).where(eq(appWorkoutExercisesTable.planId, id));
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      await db.insert(appWorkoutExercisesTable).values({
        planId: id, name: ex.name, sets: ex.sets || 3, reps: ex.reps || "10", rest: ex.rest || "60s", order: i + 1,
      });
    }
  }
  const exRows = await db.select().from(appWorkoutExercisesTable).where(eq(appWorkoutExercisesTable.planId, id)).orderBy(asc(appWorkoutExercisesTable.order));
  res.json({ ...plan, exercises: exRows });
});

router.delete("/app-content/workout-plans/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(appWorkoutExercisesTable).where(eq(appWorkoutExercisesTable.planId, id));
  await db.delete(appWorkoutPlansTable).where(eq(appWorkoutPlansTable.id, id));
  res.json({ message: "Deleted" });
});

// ── Diet Plans ─────────────────────────────────────────────────────────────
/**
 * @openapi
 * /app-content/diet-plans:
 *   get:
 *     tags:
 *       - App Content
 *     summary: Get all diet plans
 *     description: Retrieve all diet plans with meals for the mobile app
 *     security:
 *       - adminEmail: []
 *     responses:
 *       200:
 *         description: List of diet plans
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
 *                   goal:
 *                     type: string
 *                     enum: [weight_loss, muscle_gain, maintenance]
 *                   calories:
 *                     type: integer
 *                   meals:
 *                     type: array
 *                     items:
 *                       type: object
 */
router.get("/app-content/diet-plans", async (_req, res) => {
  const plans = await db.select().from(appDietPlansTable).orderBy(asc(appDietPlansTable.id));
  const result = await Promise.all(plans.map(async (p) => {
    const meals = await db.select().from(appDietMealsTable)
      .where(eq(appDietMealsTable.planId, p.id)).orderBy(asc(appDietMealsTable.order));
    return { ...p, meals };
  }));
  res.json(result);
});

router.post("/app-content/diet-plans", async (req, res) => {
  const { name, goal, calories, protein, carbs, fat, dietitian, meals } = req.body;
  if (!name) return res.status(400).json({ message: "Plan name required" });
  const [plan] = await db.insert(appDietPlansTable).values({
    name, goal: goal || "General health", calories: calories || 2000,
    protein: protein || 100, carbs: carbs || 250, fat: fat || 70,
    dietitian: dietitian || "",
  }).returning();
  if (meals && Array.isArray(meals)) {
    for (let i = 0; i < meals.length; i++) {
      const m = meals[i];
      await db.insert(appDietMealsTable).values({
        planId: plan.id, type: m.type, time: m.time,
        items: m.items || [], calories: m.calories || 0, order: i + 1,
      });
    }
  }
  const mealRows = await db.select().from(appDietMealsTable).where(eq(appDietMealsTable.planId, plan.id)).orderBy(asc(appDietMealsTable.order));
  res.json({ ...plan, meals: mealRows });
});

router.put("/app-content/diet-plans/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, goal, calories, protein, carbs, fat, dietitian, isActive, meals } = req.body;
  const [plan] = await db.update(appDietPlansTable).set({
    ...(name !== undefined && { name }), ...(goal !== undefined && { goal }),
    ...(calories !== undefined && { calories }), ...(protein !== undefined && { protein }),
    ...(carbs !== undefined && { carbs }), ...(fat !== undefined && { fat }),
    ...(dietitian !== undefined && { dietitian }), ...(isActive !== undefined && { isActive }),
  }).where(eq(appDietPlansTable.id, id)).returning();
  if (meals && Array.isArray(meals)) {
    await db.delete(appDietMealsTable).where(eq(appDietMealsTable.planId, id));
    for (let i = 0; i < meals.length; i++) {
      const m = meals[i];
      await db.insert(appDietMealsTable).values({
        planId: id, type: m.type, time: m.time,
        items: m.items || [], calories: m.calories || 0, order: i + 1,
      });
    }
  }
  const mealRows = await db.select().from(appDietMealsTable).where(eq(appDietMealsTable.planId, id)).orderBy(asc(appDietMealsTable.order));
  res.json({ ...plan, meals: mealRows });
});

router.delete("/app-content/diet-plans/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(appDietMealsTable).where(eq(appDietMealsTable.planId, id));
  await db.delete(appDietPlansTable).where(eq(appDietPlansTable.id, id));
  res.json({ message: "Deleted" });
});

// ── Plans ─────────────────────────────────────────────────────────────────
router.get("/plans", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(plansTable).orderBy(desc(plansTable.createdAt));
  res.json(rows.map(r => ({
    ...r,
    totalFee: parseFloat(r.totalFee as string),
    commissionValue: parseFloat(r.commissionValue as string),
  })));
}));

router.post("/plans", asyncHandler(async (req, res) => {
  const { name, totalFee, commissionType, commissionValue, description, isActive } = req.body;
  if (!name || totalFee === undefined) return res.status(400).json({ message: "Name and totalFee are required" });
  const [row] = await db.insert(plansTable).values({
    name,
    totalFee: String(totalFee),
    commissionType: commissionType || "percentage",
    commissionValue: String(commissionValue || 0),
    description: description || null,
    isActive: isActive !== false,
  }).returning();
  res.status(201).json({ ...row, totalFee: parseFloat(row.totalFee as string), commissionValue: parseFloat(row.commissionValue as string) });
}));

router.put("/plans/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, totalFee, commissionType, commissionValue, description, isActive } = req.body;
  const [row] = await db.update(plansTable).set({
    ...(name !== undefined && { name }),
    ...(totalFee !== undefined && { totalFee: String(totalFee) }),
    ...(commissionType !== undefined && { commissionType }),
    ...(commissionValue !== undefined && { commissionValue: String(commissionValue) }),
    ...(description !== undefined && { description }),
    ...(isActive !== undefined && { isActive }),
  }).where(eq(plansTable.id, id)).returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json({ ...row, totalFee: parseFloat(row.totalFee as string), commissionValue: parseFloat(row.commissionValue as string) });
}));

router.delete("/plans/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(plansTable).where(eq(plansTable.id, id));
  res.json({ message: "Deleted" });
}));

// ── Client Subscriptions ──────────────────────────────────────────────────
router.get("/client-subscriptions", asyncHandler(async (req, res) => {
  const { trainerId, memberId, status } = req.query as Record<string, string>;

  const rows = await db.select({
    sub: clientSubscriptionsTable,
    memberName: membersTable.name,
    trainerName: employeesTable.name,
    planName: plansTable.name,
  }).from(clientSubscriptionsTable)
    .leftJoin(membersTable, eq(clientSubscriptionsTable.memberId, membersTable.id))
    .leftJoin(employeesTable, eq(clientSubscriptionsTable.trainerId, employeesTable.id))
    .leftJoin(plansTable, eq(clientSubscriptionsTable.planId, plansTable.id))
    .orderBy(desc(clientSubscriptionsTable.createdAt));

  let result = rows.map(r => ({
    ...r.sub,
    memberName: r.memberName ?? "Unknown",
    trainerName: r.trainerName ?? "Unknown",
    planName: r.planName ?? null,
  }));

  if (trainerId) result = result.filter(r => r.trainerId === parseInt(trainerId));
  if (memberId) result = result.filter(r => r.memberId === parseInt(memberId));
  if (status && status !== "all") result = result.filter(r => r.status === status);

  res.json(result);
}));

router.post("/client-subscriptions", asyncHandler(async (req, res) => {
  const { memberId, trainerId, planId, startDate, endDate, purpose, status } = req.body;
  if (!memberId || !trainerId || !startDate) {
    return res.status(400).json({ message: "memberId, trainerId, and startDate are required" });
  }
  const [row] = await db.insert(clientSubscriptionsTable).values({
    memberId,
    trainerId,
    planId: planId || null,
    startDate,
    endDate: endDate || null,
    purpose: purpose || null,
    status: status || "active",
  }).returning();

  await db.update(membersTable).set({ assignedTrainerId: trainerId }).where(eq(membersTable.id, memberId));

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const [trainer] = await db.select().from(employeesTable).where(eq(employeesTable.id, trainerId));
  const plan = planId ? await db.select().from(plansTable).where(eq(plansTable.id, planId)).then(r => r[0]) : null;

  res.status(201).json({
    ...row,
    memberName: member?.name ?? "Unknown",
    trainerName: trainer?.name ?? "Unknown",
    planName: plan?.name ?? null,
  });
}));

router.put("/client-subscriptions/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { planId, startDate, endDate, purpose, status } = req.body;
  const [row] = await db.update(clientSubscriptionsTable).set({
    ...(planId !== undefined && { planId: planId || null }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate: endDate || null }),
    ...(purpose !== undefined && { purpose: purpose || null }),
    ...(status !== undefined && { status }),
  }).where(eq(clientSubscriptionsTable.id, id)).returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
}));

router.delete("/client-subscriptions/:id", asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(clientSubscriptionsTable).where(eq(clientSubscriptionsTable.id, id));
  res.json({ message: "Deleted" });
}));

// ── Trainer Commission Demo Seed ──────────────────────────────────────────
router.post("/trainer-commissions/seed-demo", asyncHandler(async (_req, res) => {
  const trainers = await db.select().from(employeesTable).where(eq(employeesTable.role, "trainer"));
  const members = await db.select().from(membersTable).limit(5);

  if (trainers.length === 0) return res.status(400).json({ message: "Koi trainer nahi mila. Pehle Employees mein trainer add karein." });
  if (members.length === 0) return res.status(400).json({ message: "Koi member nahi mila. Pehle Members mein member add karein." });

  const existingPlans = await db.select().from(plansTable);
  let plan1Id: number, plan2Id: number, plan3Id: number;

  if (existingPlans.length >= 3) {
    plan1Id = existingPlans[0].id;
    plan2Id = existingPlans[1].id;
    plan3Id = existingPlans[2].id;
  } else {
    const [p1] = await db.insert(plansTable).values({ name: "Personal Training - Monthly", totalFee: "8000", commissionType: "percentage", commissionValue: "30", description: "Monthly personal training plan", isActive: true }).returning();
    const [p2] = await db.insert(plansTable).values({ name: "Weight Loss Program", totalFee: "12000", commissionType: "percentage", commissionValue: "25", description: "3-month weight loss program", isActive: true }).returning();
    const [p3] = await db.insert(plansTable).values({ name: "Muscle Gain Package", totalFee: "6000", commissionType: "fixed", commissionValue: "1500", description: "Fixed commission plan", isActive: true }).returning();
    plan1Id = p1.id; plan2Id = p2.id; plan3Id = p3.id;
  }

  const trainer = trainers[0];
  const trainer2 = trainers[1] ?? trainers[0];

  const existingSubs = await db.select().from(clientSubscriptionsTable);

  if (existingSubs.length === 0) {
    const purposes = ["Weight Loss", "Muscle Gain", "General Fitness", "Cardio Improvement", "Strength Training"];
    for (let i = 0; i < Math.min(members.length, 3); i++) {
      const planId = i === 0 ? plan1Id : i === 1 ? plan2Id : plan3Id;
      const trainerId = i % 2 === 0 ? trainer.id : trainer2.id;
      await db.insert(clientSubscriptionsTable).values({
        memberId: members[i].id,
        trainerId,
        planId,
        startDate: `2025-0${i + 1}-01`,
        endDate: `2025-0${i + 3}-01`,
        purpose: purposes[i],
        status: "active",
      });
      await db.update(membersTable).set({ assignedTrainerId: trainerId }).where(eq(membersTable.id, members[i].id));
    }
  }

  const pastEarnings = [
    { trainerId: trainer.id, amount: 2400, date: "2025-01-15", invoicePlan: "monthly" },
    { trainerId: trainer.id, amount: 3000, date: "2025-02-10", invoicePlan: "quarterly" },
    { trainerId: trainer2.id, amount: 1500, date: "2025-01-20", invoicePlan: "monthly" },
    { trainerId: trainer2.id, amount: 1500, date: "2025-02-18", invoicePlan: "monthly" },
    { trainerId: trainer.id, amount: 2400, date: "2025-03-05", invoicePlan: "monthly" },
  ];

  let inserted = 0;
  for (const e of pastEarnings) {
    const [fakeInv] = await db.insert(invoicesTable).values({
      memberId: members[0].id,
      amount: String(e.amount / 0.3),
      plan: e.invoicePlan,
      dueDate: e.date,
      paidDate: e.date,
      status: "paid",
      paymentMethod: "cash",
      trainerCommission: String(e.amount),
      gymRevenue: String(Math.round((e.amount / 0.3 - e.amount) * 100) / 100),
    }).returning();

    const exists = await db.select().from(trainerEarningsTable).where(eq(trainerEarningsTable.sourcePaymentId, fakeInv.id));
    if (exists.length === 0) {
      await db.insert(trainerEarningsTable).values({
        trainerId: e.trainerId,
        sourcePaymentId: fakeInv.id,
        amount: String(e.amount),
        date: e.date,
      });
      inserted++;
    }

    const [tr] = await db.select().from(employeesTable).where(eq(employeesTable.id, e.trainerId));
    if (tr) {
      const cur = parseFloat((tr.totalEarnings as string) || "0");
      await db.update(employeesTable).set({ totalEarnings: String(cur + e.amount) }).where(eq(employeesTable.id, e.trainerId));
    }
  }

  res.json({ message: `Demo data add ho gaya! ${existingPlans.length < 3 ? "3 plans, " : ""}subscriptions aur ${inserted} earning records create kiye.` });
}));

// ── Trainer Commissions ───────────────────────────────────────────────────
router.get("/trainer-commissions", asyncHandler(async (_req, res) => {
  const trainers = await db.select().from(employeesTable).where(eq(employeesTable.role, "trainer"));

  const now = today();
  const monthStart = now.slice(0, 7) + "-01";

  const result = await Promise.all(trainers.map(async (trainer) => {
    const subs = await db.select().from(clientSubscriptionsTable)
      .where(eq(clientSubscriptionsTable.trainerId, trainer.id));

    const activeSubs = subs.filter(s => s.status === "active");

    const earnings = await db.select().from(trainerEarningsTable)
      .where(eq(trainerEarningsTable.trainerId, trainer.id));

    const totalEarnings = earnings.reduce((s, e) => s + parseFloat(e.amount as string), 0);
    const monthlyEarnings = earnings
      .filter(e => e.date >= monthStart)
      .reduce((s, e) => s + parseFloat(e.amount as string), 0);

    return {
      trainerId: trainer.id,
      trainerName: trainer.name,
      phone: trainer.phone,
      email: trainer.email,
      commission: parseFloat((trainer.commission as string) || "0"),
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
      totalClients: subs.length,
      activeClients: activeSubs.length,
      status: trainer.status,
    };
  }));

  res.json(result);
}));

router.get("/trainer-commissions/reports/monthly", asyncHandler(async (req, res) => {
  const { month } = req.query as Record<string, string>;
  const period = month || today().slice(0, 7);
  const monthStart = period + "-01";
  const year = parseInt(period.slice(0, 4));
  const mon = parseInt(period.slice(5, 7));
  const nextMonth = mon === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

  const earnings = await db.select({
    earning: trainerEarningsTable,
    trainerName: employeesTable.name,
  }).from(trainerEarningsTable)
    .leftJoin(employeesTable, eq(trainerEarningsTable.trainerId, employeesTable.id))
    .where(and(gte(trainerEarningsTable.date, monthStart), lte(trainerEarningsTable.date, nextMonth)));

  const paidInvoices = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.status, "paid"), gte(invoicesTable.paidDate as any, monthStart)));

  const totalGymRevenue = paidInvoices.reduce((s, i) => {
    const gr = i.gymRevenue ? parseFloat(i.gymRevenue as string) : parseFloat(i.amount as string);
    return s + gr;
  }, 0);

  const totalCommissions = earnings.reduce((s, e) => s + parseFloat(e.earning.amount as string), 0);

  const byTrainer = earnings.reduce<Record<number, { trainerName: string; amount: number }>>((acc, e) => {
    const tid = e.earning.trainerId;
    if (!acc[tid]) acc[tid] = { trainerName: e.trainerName ?? "Unknown", amount: 0 };
    acc[tid].amount += parseFloat(e.earning.amount as string);
    return acc;
  }, {});

  res.json({
    month: period,
    totalGymRevenue: Math.round(totalGymRevenue * 100) / 100,
    totalCommissions: Math.round(totalCommissions * 100) / 100,
    trainerBreakdown: Object.entries(byTrainer).map(([id, data]) => ({
      trainerId: parseInt(id),
      trainerName: data.trainerName,
      amount: Math.round(data.amount * 100) / 100,
    })),
  });
}));

router.get("/trainer-commissions/:trainerId", asyncHandler(async (req, res) => {
  const trainerId = parseInt(req.params.trainerId as string);
  const [trainer] = await db.select().from(employeesTable).where(eq(employeesTable.id, trainerId));
  if (!trainer) return res.status(404).json({ message: "Trainer not found" });

  const subs = await db.select({
    sub: clientSubscriptionsTable,
    memberName: membersTable.name,
    memberPhone: membersTable.phone,
    planName: plansTable.name,
    commissionType: plansTable.commissionType,
    commissionValue: plansTable.commissionValue,
  }).from(clientSubscriptionsTable)
    .leftJoin(membersTable, eq(clientSubscriptionsTable.memberId, membersTable.id))
    .leftJoin(plansTable, eq(clientSubscriptionsTable.planId, plansTable.id))
    .where(eq(clientSubscriptionsTable.trainerId, trainerId))
    .orderBy(desc(clientSubscriptionsTable.createdAt));

  const now = today();
  const monthStart = now.slice(0, 7) + "-01";

  const earnings = await db.select({
    earning: trainerEarningsTable,
    memberName: membersTable.name,
    invoiceAmount: invoicesTable.amount,
    invoicePlan: invoicesTable.plan,
  }).from(trainerEarningsTable)
    .leftJoin(invoicesTable, eq(trainerEarningsTable.sourcePaymentId, invoicesTable.id))
    .leftJoin(membersTable, eq(invoicesTable.memberId, membersTable.id))
    .where(eq(trainerEarningsTable.trainerId, trainerId))
    .orderBy(desc(trainerEarningsTable.createdAt));

  const totalEarnings = earnings.reduce((s, e) => s + parseFloat(e.earning.amount as string), 0);
  const monthlyEarnings = earnings
    .filter(e => e.earning.date >= monthStart)
    .reduce((s, e) => s + parseFloat(e.earning.amount as string), 0);

  res.json({
    trainer: {
      ...trainer,
      commission: parseFloat((trainer.commission as string) || "0"),
      totalEarnings: parseFloat((trainer.totalEarnings as string) || "0"),
    },
    subscriptions: subs.map(s => ({
      ...s.sub,
      memberName: s.memberName ?? "Unknown",
      memberPhone: s.memberPhone ?? "",
      planName: s.planName ?? null,
      commissionType: s.commissionType ?? null,
      commissionValue: s.commissionValue ? parseFloat(s.commissionValue as string) : null,
    })),
    earnings: earnings.map(e => ({
      ...e.earning,
      amount: parseFloat(e.earning.amount as string),
      memberName: e.memberName ?? "Unknown",
      invoiceAmount: e.invoiceAmount ? parseFloat(e.invoiceAmount as string) : 0,
      invoicePlan: e.invoicePlan ?? null,
    })),
    stats: {
      totalClients: subs.length,
      activeClients: subs.filter(s => s.sub.status === "active").length,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
    },
  });
}));

router.get("/trainer-commissions/:trainerId/earnings", asyncHandler(async (req, res) => {
  const trainerId = parseInt(req.params.trainerId as string);
  const { month } = req.query as Record<string, string>;

  const rows = await db.select({
    earning: trainerEarningsTable,
    memberName: membersTable.name,
    invoiceAmount: invoicesTable.amount,
    invoicePlan: invoicesTable.plan,
  }).from(trainerEarningsTable)
    .leftJoin(invoicesTable, eq(trainerEarningsTable.sourcePaymentId, invoicesTable.id))
    .leftJoin(membersTable, eq(invoicesTable.memberId, membersTable.id))
    .where(eq(trainerEarningsTable.trainerId, trainerId))
    .orderBy(desc(trainerEarningsTable.createdAt));

  let result = rows.map(r => ({
    ...r.earning,
    amount: parseFloat(r.earning.amount as string),
    memberName: r.memberName ?? "Unknown",
    invoiceAmount: r.invoiceAmount ? parseFloat(r.invoiceAmount as string) : 0,
    invoicePlan: r.invoicePlan ?? "",
  }));

  if (month) {
    result = result.filter(r => r.date.startsWith(month));
  }

  res.json(result);
}));

// ── Onboarding Slides ──────────────────────────────────────────────────────
router.get("/app-content/onboarding-slides", async (_req, res) => {
  const rows = await db.select().from(appOnboardingSlidesTable).orderBy(asc(appOnboardingSlidesTable.order));
  res.json(rows);
});

router.put("/app-content/onboarding-slides/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { title, subtitle, description, isActive } = req.body;
  const [row] = await db.update(appOnboardingSlidesTable).set({
    ...(title !== undefined && { title }), ...(subtitle !== undefined && { subtitle }),
    ...(description !== undefined && { description }), ...(isActive !== undefined && { isActive }),
  }).where(eq(appOnboardingSlidesTable.id, id)).returning();
  res.json(row);
});

export default router;
