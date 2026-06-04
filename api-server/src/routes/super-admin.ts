import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  gymsTable,
  subscriptionsTable,
  subscriptionPlansTable,
  paymentHistoryTable,
  adminUsersTable,
  membersTable,
} from "@workspace/db";
import { eq, desc, count, sql, and, gte, lte, or, like } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../../../lib/middleware/auth";

const router = Router();

// Middleware: Require super_admin role (no gym context needed for platform-wide data)
const superAdminOnly = [authenticate, requireRole("super_admin")];

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const getEffectiveStatus = (status: string | null | undefined, expiresAt: Date | string | null | undefined) => {
  if (["suspended", "cancelled"].includes(status || "")) return status || "suspended";
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return "expired";
  return status || "trial";
};

const getDaysRemaining = (expiresAt: Date | string | null | undefined) => {
  if (!expiresAt) return 0;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

/**
 * @openapi
 * /super-admin/dashboard/stats:
 *   get:
 *     tags:
 *       - Super Admin
 *     summary: Get dashboard overview stats
 *     description: Get key metrics for super admin dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalGyms:
 *                   type: integer
 *                 activeGyms:
 *                   type: integer
 *                 totalSubscriptions:
 *                   type: integer
 *                 activeSubscriptions:
 *                   type: integer
 *                 mrr:
 *                   type: number
 *                   description: Monthly Recurring Revenue
 *                 totalRevenue:
 *                   type: number
 *                 recentGyms:
 *                   type: array
 *                 recentPayments:
 *                   type: array
 */
router.get("/super-admin/dashboard/stats", superAdminOnly, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const gymsWithPlans = await db
      .select({
        id: gymsTable.id,
        name: gymsTable.name,
        email: gymsTable.email,
        isActive: gymsTable.isActive,
        subscriptionStatus: gymsTable.subscriptionStatus,
        subscriptionTier: gymsTable.subscriptionTier,
        createdAt: gymsTable.createdAt,
        monthlyPrice: subscriptionPlansTable.monthlyPrice,
      })
      .from(gymsTable)
      .leftJoin(subscriptionPlansTable, eq(gymsTable.subscriptionTier, subscriptionPlansTable.slug));

    const totalGyms = gymsWithPlans.length;
    const activeGyms = gymsWithPlans.filter((gym) => gym.isActive).length;
    const activeSubscriptions = gymsWithPlans.filter((gym) => gym.subscriptionStatus === "active").length;
    const trialSubscriptions = gymsWithPlans.filter((gym) => gym.subscriptionStatus === "trial").length;
    const totalSubscriptions = gymsWithPlans.length;

    const mrr = gymsWithPlans.reduce((sum, gym) => {
      if (!["active", "trial"].includes(gym.subscriptionStatus || "")) return sum;
      return sum + (parseFloat(String(gym.monthlyPrice || "0")) || 0);
    }, 0);

    // Total revenue (all successful payments)
    const [{ total: totalRevenue }] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentHistoryTable.amount} AS DECIMAL)), 0)`,
      })
      .from(paymentHistoryTable)
      .where(eq(paymentHistoryTable.status, "succeeded"));

    const recentGyms = gymsWithPlans
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, 5)
      .map((gym) => ({
        id: gym.id,
        name: gym.name,
        email: gym.email,
        status: gym.subscriptionStatus,
        subscriptionStatus: gym.subscriptionStatus,
        subscriptionTier: gym.subscriptionTier,
        createdAt: gym.createdAt,
      }));

    // Recent payments (last 10)
    const recentPayments = await db
      .select({
        id: paymentHistoryTable.id,
        gymId: paymentHistoryTable.gymId,
        amount: paymentHistoryTable.amount,
        status: paymentHistoryTable.status,
        paidAt: paymentHistoryTable.paidAt,
        gym: {
          name: gymsTable.name,
        },
      })
      .from(paymentHistoryTable)
      .leftJoin(gymsTable, eq(paymentHistoryTable.gymId, gymsTable.id))
      .orderBy(desc(paymentHistoryTable.createdAt))
      .limit(10);

    const stats = {
      totalGyms: Number(totalGyms),
      activeGyms: Number(activeGyms),
      totalSubscriptions: Number(totalSubscriptions),
      activeSubscriptions: Number(activeSubscriptions),
      trialSubscriptions: Number(trialSubscriptions),
      mrr: Math.round(mrr),
      monthlyRecurringRevenue: Math.round(mrr),
      totalRevenue: parseFloat(totalRevenue || "0") || Math.round(mrr),
    };

    const payments = recentPayments.map((payment: any) => ({
      id: payment.id,
      gymId: payment.gymId,
      gymName: payment.gym?.name || "Unknown Gym",
      amount: parseFloat(String(payment.amount || "0")) || 0,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.paidAt || new Date().toISOString(),
    }));
    const recentPaymentsList = payments.length > 0
      ? payments
      : gymsWithPlans
        .filter((gym) => ["active", "trial"].includes(gym.subscriptionStatus || ""))
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 10)
        .map((gym) => ({
          id: `gym-payment-${gym.id}`,
          gymId: gym.id,
          gymName: gym.name,
          amount: parseFloat(String(gym.monthlyPrice || "0")) || 0,
          status: gym.subscriptionStatus === "trial" ? "trial" : "succeeded",
          paidAt: gym.createdAt,
          createdAt: gym.createdAt,
        }));

    return res.json({
      success: true,
      data: {
        ...stats,
        stats,
        recentGyms,
        recentPayments: recentPaymentsList,
      },
    });
  } catch (error: any) {
    console.error("[SUPER ADMIN STATS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard stats",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/gyms:
 *   get:
 *     tags:
 *       - Super Admin
 *     summary: List all gyms
 *     description: Get paginated list of all gyms with filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, trial, suspended, cancelled]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of gyms
 */
router.get("/super-admin/gyms", superAdminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(gymsTable.subscriptionStatus, status));
    }
    if (search) {
      conditions.push(
        or(
          like(gymsTable.name, `%${search}%`),
          like(gymsTable.email, `%${search}%`)
        )
      );
    }

    // Get gyms with subscription info
    const gymsRaw = await db
      .select({
        id: gymsTable.id,
        name: gymsTable.name,
        slug: gymsTable.slug,
        email: gymsTable.email,
        phone: gymsTable.phone,
        address: gymsTable.address,
        city: gymsTable.city,
        logoUrl: gymsTable.logoUrl,
        currency: gymsTable.currency,
        timezone: gymsTable.timezone,
        dailyFee: gymsTable.dailyFee,
        weeklyFee: gymsTable.weeklyFee,
        monthlyFee: gymsTable.monthlyFee,
        quarterlyFee: gymsTable.quarterlyFee,
        yearlyFee: gymsTable.yearlyFee,
        subscriptionStatus: gymsTable.subscriptionStatus,
        subscriptionTier: gymsTable.subscriptionTier,
        subscriptionExpiresAt: gymsTable.subscriptionExpiresAt,
        isActive: gymsTable.isActive,
        createdAt: gymsTable.createdAt,
      })
      .from(gymsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(gymsTable.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich each gym with subscription and owner info
    const gyms = await Promise.all(
      gymsRaw.map(async (gym) => {
        // Get current active subscription
        const [subscription] = await db
          .select({
            id: subscriptionsTable.id,
            tier: subscriptionPlansTable.slug,
            status: subscriptionsTable.status,
            currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
            amount: subscriptionsTable.amount,
          })
          .from(subscriptionsTable)
          .leftJoin(
            subscriptionPlansTable,
            eq(subscriptionsTable.planId, subscriptionPlansTable.id)
          )
          .where(eq(subscriptionsTable.gymId, gym.id))
          .orderBy(desc(subscriptionsTable.createdAt))
          .limit(1);

        // Get gym owner (first admin with "admin" or "owner" role)
        const [owner] = await db
          .select({
            id: adminUsersTable.id,
            name: adminUsersTable.name,
            email: adminUsersTable.email,
          })
          .from(adminUsersTable)
          .where(
            and(
              eq(adminUsersTable.gymId, gym.id),
              or(
                eq(adminUsersTable.role, "admin"),
                eq(adminUsersTable.role, "owner"),
                eq(adminUsersTable.role, "gym_owner")
              )
            )
          )
          .limit(1);

        const [{ count: memberCount }] = await db
          .select({ count: count() })
          .from(membersTable)
          .where(eq(membersTable.gymId, gym.id));

        const expiryDate = subscription?.currentPeriodEnd || gym.subscriptionExpiresAt;
        const effectiveStatus = getEffectiveStatus(subscription?.status || gym.subscriptionStatus, expiryDate);

        return {
          ...gym,
          status: gym.isActive ? effectiveStatus : "suspended",
          subscription: subscription || null,
          currentPlan: subscription?.tier || gym.subscriptionTier || "basic",
          subscriptionStatus: effectiveStatus,
          subscriptionExpiresAt: toIso(expiryDate),
          daysRemaining: getDaysRemaining(expiryDate),
          memberCount: Number(memberCount),
          ownerId: owner?.id || null,
          ownerName: owner?.name || null,
          ownerEmail: owner?.email || null,
        };
      })
    );

    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(gymsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return res.json({
      success: true,
      data: {
        gyms,
        pagination: {
          page,
          limit,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("[LIST GYMS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch gyms",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/gyms/{gymId}:
 *   get:
 *     tags:
 *       - Super Admin
 *     summary: Get gym details
 *     description: Get detailed information about a specific gym
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gymId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym details
 */
router.get("/super-admin/gyms/:gymId", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;

    // Get gym
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

    // Get current subscription
    const [subscription] = await db
      .select({
        subscription: subscriptionsTable,
        plan: subscriptionPlansTable,
      })
      .from(subscriptionsTable)
      .leftJoin(
        subscriptionPlansTable,
        eq(subscriptionsTable.planId, subscriptionPlansTable.id)
      )
      .where(eq(subscriptionsTable.gymId, gymId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    // Get payment history
    const payments = await db
      .select()
      .from(paymentHistoryTable)
      .where(eq(paymentHistoryTable.gymId, gymId))
      .orderBy(desc(paymentHistoryTable.createdAt))
      .limit(10);

    // Get member count
    const [{ count: memberCount }] = await db
      .select({ count: count() })
      .from(membersTable)
      .where(eq(membersTable.gymId, gymId));

    // Get staff count
    const [{ count: staffCount }] = await db
      .select({ count: count() })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.gymId, gymId));

    return res.json({
      success: true,
      data: {
        gym,
        subscription: subscription || null,
        payments,
        stats: {
          memberCount: Number(memberCount),
          staffCount: Number(staffCount),
        },
      },
    });
  } catch (error: any) {
    console.error("[GET GYM DETAILS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch gym details",
      details: error.message,
    });
  }
});

router.patch("/super-admin/gyms/:gymId", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;
    const allowedFields = [
      "name",
      "email",
      "phone",
      "address",
      "city",
      "currency",
      "timezone",
      "dailyFee",
      "weeklyFee",
      "monthlyFee",
      "quarterlyFee",
      "yearlyFee",
    ];
    const updates: Record<string, any> = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId));
    if (!gym) return res.status(404).json({ success: false, error: "Gym not found" });

    await db.update(gymsTable).set(updates).where(eq(gymsTable.id, gymId));

    return res.json({ success: true, message: `${updates.name || gym.name} updated successfully` });
  } catch (error: any) {
    console.error("[EDIT GYM ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to update gym", details: error.message });
  }
});

router.post("/super-admin/gyms/:gymId/reset-owner-password", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const [owner] = await db
      .select()
      .from(adminUsersTable)
      .where(and(eq(adminUsersTable.gymId, gymId), or(eq(adminUsersTable.role, "admin"), eq(adminUsersTable.role, "owner"), eq(adminUsersTable.role, "gym_owner"))))
      .limit(1);

    if (!owner) return res.status(404).json({ success: false, error: "Gym owner not found" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(adminUsersTable).set({ password: hashed }).where(eq(adminUsersTable.id, owner.id));

    return res.json({ success: true, message: `Password reset for ${owner.email}` });
  } catch (error: any) {
    console.error("[RESET OWNER PASSWORD ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to reset owner password", details: error.message });
  }
});

router.post("/super-admin/gyms/:gymId/login-as", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;
    const [owner] = await db
      .select()
      .from(adminUsersTable)
      .where(and(eq(adminUsersTable.gymId, gymId), or(eq(adminUsersTable.role, "admin"), eq(adminUsersTable.role, "owner"), eq(adminUsersTable.role, "gym_owner"))))
      .limit(1);

    if (!owner) return res.status(404).json({ success: false, error: "Gym owner not found" });

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error("JWT_SECRET not configured");

    const token = jwt.sign(
      {
        userId: owner.id.toString(),
        gymId: owner.gymId,
        role: owner.role,
        email: owner.email,
        impersonatedBy: "super_admin",
        permissions: {
          members: owner.permissions || ["*"],
          billing: owner.permissions || ["*"],
          attendance: owner.permissions || ["*"],
          reports: owner.permissions || ["*"],
          inventory: owner.permissions || ["*"],
          settings: owner.permissions || ["*"],
        },
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as any
    );

    const { password: _password, ...safeUser } = owner;
    return res.json({ success: true, token, user: safeUser });
  } catch (error: any) {
    console.error("[LOGIN AS GYM ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to login as gym", details: error.message });
  }
});

/**
 * @openapi
 * /super-admin/gyms/{gymId}/suspend:
 *   post:
 *     tags:
 *       - Super Admin
 *     summary: Suspend a gym
 *     description: Suspend a gym's access
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gymId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym suspended
 */
router.post("/super-admin/gyms/:gymId/suspend", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;

    await db
      .update(gymsTable)
      .set({
        subscriptionStatus: "suspended",
        isActive: false,
      })
      .where(eq(gymsTable.id, gymId));

    return res.json({
      success: true,
      message: "Gym suspended successfully",
    });
  } catch (error: any) {
    console.error("[SUSPEND GYM ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to suspend gym",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/gyms/{gymId}/activate:
 *   post:
 *     tags:
 *       - Super Admin
 *     summary: Activate a gym
 *     description: Activate a suspended gym
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gymId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym activated
 */
router.post("/super-admin/gyms/:gymId/activate", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;

    await db
      .update(gymsTable)
      .set({
        subscriptionStatus: "active",
        isActive: true,
      })
      .where(eq(gymsTable.id, gymId));

    return res.json({
      success: true,
      message: "Gym activated successfully",
    });
  } catch (error: any) {
    console.error("[ACTIVATE GYM ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to activate gym",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/subscriptions:
 *   get:
 *     tags:
 *       - Super Admin
 *     summary: List all subscriptions
 *     description: Get paginated list of all subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: planId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of subscriptions
 */
router.get("/super-admin/subscriptions", superAdminOnly, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const statusFilter = req.query.status as string;
    const tierFilter = req.query.tier as string;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    // Strategy: Show ALL gyms as subscriptions (trial + paid)
    // First get gyms with their latest subscription from subscriptions table
    const gymsRaw = await db
      .select({
        gymId: gymsTable.id,
        gymName: gymsTable.name,
        gymEmail: gymsTable.email,
        gymStatus: gymsTable.subscriptionStatus,
        gymTier: gymsTable.subscriptionTier,
        gymExpiresAt: gymsTable.subscriptionExpiresAt,
        gymCreatedAt: gymsTable.createdAt,
        isActive: gymsTable.isActive,
      })
      .from(gymsTable)
      .orderBy(desc(gymsTable.createdAt));

    const plans = await db
      .select({
        slug: subscriptionPlansTable.slug,
        monthlyPrice: subscriptionPlansTable.monthlyPrice,
        yearlyPrice: subscriptionPlansTable.yearlyPrice,
        maxMembers: subscriptionPlansTable.maxMembers,
        maxStaff: subscriptionPlansTable.maxStaff,
        maxBranches: subscriptionPlansTable.maxBranches,
      })
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, true));
    const plansBySlug = new Map(plans.map((plan) => [plan.slug, plan]));

    // For each gym, get latest subscription record if exists
    const result = await Promise.all(
      gymsRaw.map(async (gym) => {
        const [sub] = await db
          .select({
            id: subscriptionsTable.id,
            status: subscriptionsTable.status,
            billingCycle: subscriptionsTable.billingCycle,
            amount: subscriptionsTable.amount,
            currentPeriodStart: subscriptionsTable.currentPeriodStart,
            currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
            createdAt: subscriptionsTable.createdAt,
            canceledAt: subscriptionsTable.canceledAt,
            cancelAtPeriodEnd: subscriptionsTable.cancelAtPeriodEnd,
            planSlug: subscriptionPlansTable.slug,
            planName: subscriptionPlansTable.name,
            maxMembers: subscriptionPlansTable.maxMembers,
            maxStaff: subscriptionPlansTable.maxStaff,
            maxBranches: subscriptionPlansTable.maxBranches,
          })
          .from(subscriptionsTable)
          .leftJoin(subscriptionPlansTable, eq(subscriptionsTable.planId, subscriptionPlansTable.id))
          .where(eq(subscriptionsTable.gymId, gym.gymId))
          .orderBy(desc(subscriptionsTable.createdAt))
          .limit(1);

        // If gym has a paid subscription record, use that
        if (sub) {
          const expiresAt = sub.currentPeriodEnd || gym.gymExpiresAt;
          const status = getEffectiveStatus(sub.status, expiresAt);
          return {
            id: String(sub.id),
            gymId: gym.gymId,
            gymName: gym.gymName || "Unknown Gym",
            tier: sub.planSlug || gym.gymTier || "basic",
            status,
            billingCycle: sub.billingCycle || "monthly",
            amount: parseFloat(sub.amount as string) || 0,
            currentPeriodStart: toIso(sub.currentPeriodStart || gym.gymCreatedAt),
            currentPeriodEnd: toIso(expiresAt),
            expiresAt: toIso(expiresAt),
            daysRemaining: getDaysRemaining(expiresAt),
            createdAt: toIso(sub.createdAt || gym.gymCreatedAt),
            limits: {
              maxMembers: sub.maxMembers,
              maxStaff: sub.maxStaff,
              maxBranches: sub.maxBranches,
            },
          };
        }

        // Otherwise use gym's trial/status info
        const tier = gym.gymTier || "basic";
        const plan = plansBySlug.get(tier);
        const status = getEffectiveStatus(gym.gymStatus, gym.gymExpiresAt);
        return {
          id: `gym-${gym.gymId}`,
          gymId: gym.gymId,
          gymName: gym.gymName || "Unknown Gym",
          tier,
          status,
          billingCycle: "monthly",
          amount: parseFloat(String(plan?.monthlyPrice || "0")) || 0,
          currentPeriodStart: toIso(gym.gymCreatedAt),
          currentPeriodEnd: toIso(gym.gymExpiresAt),
          expiresAt: toIso(gym.gymExpiresAt),
          daysRemaining: getDaysRemaining(gym.gymExpiresAt),
          createdAt: toIso(gym.gymCreatedAt),
          limits: {
            maxMembers: plan?.maxMembers,
            maxStaff: plan?.maxStaff,
            maxBranches: plan?.maxBranches,
          },
        };
      })
    );

    // Apply filters
    let filtered = result;
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    if (tierFilter && tierFilter !== "all") {
      filtered = filtered.filter(r => r.tier === tierFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r => r.gymName.toLowerCase().includes(s));
    }

    return res.json({
      success: true,
      data: {
        subscriptions: filtered,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("[LIST SUBSCRIPTIONS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch subscriptions",
      details: error.message,
    });
  }
});

// ── Delete admin user ────────────────────────────────────────────────────
router.delete("/super-admin/admin-users/:userId", superAdminOnly, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const authReq = req as AuthenticatedRequest;

    const parsedId = parseInt(userId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, parsedId));
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    // Prevent super admin from deleting themselves
    if (String(user.id) === String(authReq.user?.userId)) {
      return res.status(400).json({ success: false, error: "Cannot delete your own account" });
    }

    // Prevent deleting other super admins
    if (user.role === "super_admin") {
      return res.status(400).json({ success: false, error: "Cannot delete a super admin account" });
    }

    // If this user is a gym_owner, also delete their gym (cascade will handle rest)
    // If this user is staff/manager with a gymId, just delete the user
    await db.delete(adminUsersTable).where(eq(adminUsersTable.id, parsedId));

    return res.json({ success: true, message: "Admin user deleted successfully" });
  } catch (error: any) {
    console.error("[DELETE ADMIN USER ERROR]", error?.message, error?.detail || "");
    // Return actual DB error message to help diagnose
    return res.status(500).json({
      success: false,
      error: "Failed to delete admin user",
      details: error?.message || "Unknown error",
    });
  }
});

// ── Suspend admin user ───────────────────────────────────────────────────
router.post("/super-admin/admin-users/:userId/suspend", superAdminOnly, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const authReq = req as AuthenticatedRequest;

    const parsedId = parseInt(userId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, parsedId));
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    // Cannot suspend yourself
    if (String(user.id) === String(authReq.user?.userId)) {
      return res.status(400).json({ success: false, error: "Cannot suspend your own account" });
    }

    // Cannot suspend super admins
    if (user.role === "super_admin") {
      return res.status(400).json({ success: false, error: "Cannot suspend a super admin account" });
    }

    await db.update(adminUsersTable)
      .set({ status: "suspended" })
      .where(eq(adminUsersTable.id, parsedId));

    // If this is a gym owner, also suspend their gym
    if (user.gymId && (user.role === "gym_owner" || user.role === "owner")) {
      await db.update(gymsTable)
        .set({
          subscriptionStatus: "suspended",
          isActive: false
        })
        .where(eq(gymsTable.id, user.gymId));
    }

    return res.json({ success: true, message: "Admin user suspended successfully" });
  } catch (error: any) {
    console.error("[SUSPEND ADMIN USER ERROR]", error?.message);
    return res.status(500).json({ success: false, error: "Failed to suspend admin user", details: error?.message });
  }
});

// ── Activate admin user ──────────────────────────────────────────────────
router.post("/super-admin/admin-users/:userId/activate", superAdminOnly, async (req: any, res: any) => {
  try {
    const { userId } = req.params;

    const parsedId = parseInt(userId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, parsedId));
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    if (user.role === "super_admin") {
      return res.status(400).json({ success: false, error: "Cannot modify a super admin account" });
    }

    await db.update(adminUsersTable)
      .set({ status: "active" })
      .where(eq(adminUsersTable.id, parsedId));

    // If this is a gym owner, also reactivate their gym
    if (user.gymId && (user.role === "gym_owner" || user.role === "owner")) {
      await db.update(gymsTable)
        .set({
          subscriptionStatus: "active",
          isActive: true
        })
        .where(eq(gymsTable.id, user.gymId));
    }

    return res.json({ success: true, message: "Admin user activated successfully" });
  } catch (error: any) {
    console.error("[ACTIVATE ADMIN USER ERROR]", error?.message);
    return res.status(500).json({ success: false, error: "Failed to activate admin user", details: error?.message });
  }
});

// ── Reset admin user password ─────────────────────────────────────────────
router.post("/super-admin/admin-users/:userId/reset-password", superAdminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const bcrypt = await import("bcrypt");
    const hashed = await bcrypt.hash(newPassword, 10);

    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, parseInt(userId)));
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    await db.update(adminUsersTable)
      .set({ password: hashed })
      .where(eq(adminUsersTable.id, parseInt(userId)));

    return res.json({ success: true, message: "Password reset successfully" });
  } catch (error: any) {
    console.error("[RESET PASSWORD ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to reset password" });
  }
});

// ── List all admin users across all gyms ─────────────────────────────────
router.get("/super-admin/admin-users", superAdminOnly, async (req, res) => {
  try {
    const search = req.query.search as string;
    const role = req.query.role as string;

    const conditions = [];
    if (role && role !== "all") {
      conditions.push(eq(adminUsersTable.role, role));
    }
    if (search) {
      conditions.push(
        or(
          like(adminUsersTable.name, `%${search}%`),
          like(adminUsersTable.email, `%${search}%`)
        )
      );
    }

    // Get admin users with gym name — exclude password field
    const users = await db
      .select({
        id: adminUsersTable.id,
        name: adminUsersTable.name,
        email: adminUsersTable.email,
        role: adminUsersTable.role,
        status: adminUsersTable.status,
        permissions: adminUsersTable.permissions,
        gymId: adminUsersTable.gymId,
        gymName: gymsTable.name,
        lastLogin: adminUsersTable.lastLogin,
        createdAt: adminUsersTable.createdAt,
      })
      .from(adminUsersTable)
      .leftJoin(gymsTable, eq(adminUsersTable.gymId, gymsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adminUsersTable.createdAt));

    return res.json({
      success: true,
      data: {
        users,
        total: users.length,
      },
    });
  } catch (error: any) {
    console.error("[LIST ADMIN USERS ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to fetch admin users" });
  }
});

// ── Assign subscription plan to a gym (manual override by super admin) ───
router.post("/super-admin/gyms/:gymId/assign-plan", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;
    const { planId, billingCycle, durationMonths, expiryDate } = req.body;

    if (!planId || !billingCycle) {
      return res.status(400).json({ success: false, error: "planId and billingCycle are required" });
    }

    // Verify gym exists
    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId));
    if (!gym) return res.status(404).json({ success: false, error: "Gym not found" });

    // Verify plan exists
    const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId));
    if (!plan) return res.status(404).json({ success: false, error: "Plan not found" });

    const months = durationMonths || (billingCycle === "yearly" ? 12 : 1);
    const now = new Date();
    const periodEnd = expiryDate ? new Date(expiryDate) : new Date(now);
    if (!expiryDate) periodEnd.setMonth(periodEnd.getMonth() + months);

    const amount = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

    // Insert subscription record
    await db.insert(subscriptionsTable).values({
      gymId: gymId,
      planId: planId,
      status: "active",
      billingCycle: billingCycle,
      amount: String(amount),
      currency: "PKR",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    } as any);

    // Update gym subscription status
    await db.update(gymsTable).set({
      subscriptionStatus: "active",
      subscriptionTier: plan.slug,
      subscriptionExpiresAt: periodEnd,
      isActive: true,
    }).where(eq(gymsTable.id, gymId));

    return res.json({
      success: true,
      message: `${plan.name} plan assigned to ${gym.name} successfully`,
    });
  } catch (error: any) {
    console.error("[ASSIGN PLAN ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to assign plan", details: error.message });
  }
});

// ── Subscription status actions: suspend, activate, cancel ───────────────
router.post("/super-admin/gyms/:gymId/subscription/status", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;
    const { status } = req.body;
    const allowed = ["active", "suspended", "cancelled"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId));
    if (!gym) return res.status(404).json({ success: false, error: "Gym not found" });

    await db.update(gymsTable).set({
      subscriptionStatus: status,
      isActive: status === "active",
    }).where(eq(gymsTable.id, gymId));

    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.gymId, gymId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (subscription) {
      await db.update(subscriptionsTable).set({
        status: status === "cancelled" ? "canceled" : status,
        canceledAt: status === "cancelled" ? new Date() : null,
      } as any).where(eq(subscriptionsTable.id, subscription.id));
    }

    return res.json({ success: true, message: `${gym.name} marked ${status}` });
  } catch (error: any) {
    console.error("[SUBSCRIPTION STATUS ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to update subscription status", details: error.message });
  }
});

// ── Renew subscription ───────────────────────────────────────────────────
router.post("/super-admin/gyms/:gymId/subscription/renew", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;
    const { durationMonths = 1, billingCycle = "monthly" } = req.body;
    const months = Number(durationMonths) || (billingCycle === "yearly" ? 12 : 1);

    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId));
    if (!gym) return res.status(404).json({ success: false, error: "Gym not found" });

    const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.slug, gym.subscriptionTier || "basic"));
    if (!plan) return res.status(404).json({ success: false, error: "Plan not found" });

    const now = new Date();
    const currentExpiry = gym.subscriptionExpiresAt && new Date(gym.subscriptionExpiresAt) > now
      ? new Date(gym.subscriptionExpiresAt)
      : now;
    const periodEnd = new Date(currentExpiry);
    periodEnd.setMonth(periodEnd.getMonth() + months);
    const amount = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

    await db.insert(subscriptionsTable).values({
      gymId,
      planId: plan.id,
      status: "active",
      billingCycle,
      amount: String(amount),
      currency: "PKR",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    } as any);

    await db.update(gymsTable).set({
      subscriptionStatus: "active",
      subscriptionExpiresAt: periodEnd,
      isActive: true,
    }).where(eq(gymsTable.id, gymId));

    return res.json({ success: true, message: `${gym.name} renewed until ${periodEnd.toLocaleDateString()}` });
  } catch (error: any) {
    console.error("[RENEW SUBSCRIPTION ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to renew subscription", details: error.message });
  }
});

// ── Billing history ──────────────────────────────────────────────────────
router.get("/super-admin/gyms/:gymId/billing-history", superAdminOnly, async (req, res) => {
  try {
    const { gymId } = req.params;
    const payments = await db
      .select({
        id: paymentHistoryTable.id,
        amount: paymentHistoryTable.amount,
        status: paymentHistoryTable.status,
        paidAt: paymentHistoryTable.paidAt,
        createdAt: paymentHistoryTable.createdAt,
      })
      .from(paymentHistoryTable)
      .where(eq(paymentHistoryTable.gymId, gymId))
      .orderBy(desc(paymentHistoryTable.createdAt));

    const subscriptions = await db
      .select({
        id: subscriptionsTable.id,
        amount: subscriptionsTable.amount,
        status: subscriptionsTable.status,
        billingCycle: subscriptionsTable.billingCycle,
        currentPeriodStart: subscriptionsTable.currentPeriodStart,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
        createdAt: subscriptionsTable.createdAt,
        planName: subscriptionPlansTable.name,
      })
      .from(subscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionsTable.planId, subscriptionPlansTable.id))
      .where(eq(subscriptionsTable.gymId, gymId))
      .orderBy(desc(subscriptionsTable.createdAt));

    if (payments.length === 0 && subscriptions.length === 0) {
      const [gym] = await db.select({
        id: gymsTable.id,
        name: gymsTable.name,
        subscriptionTier: gymsTable.subscriptionTier,
        subscriptionStatus: gymsTable.subscriptionStatus,
        subscriptionExpiresAt: gymsTable.subscriptionExpiresAt,
        createdAt: gymsTable.createdAt,
        monthlyPrice: subscriptionPlansTable.monthlyPrice,
      })
        .from(gymsTable)
        .leftJoin(subscriptionPlansTable, eq(gymsTable.subscriptionTier, subscriptionPlansTable.slug))
        .where(eq(gymsTable.id, gymId));

      return res.json({
        success: true,
        data: {
          history: gym ? [{
            id: `fallback-${gym.id}`,
            type: "subscription",
            planName: gym.subscriptionTier,
            amount: parseFloat(String(gym.monthlyPrice || "0")) || 0,
            status: gym.subscriptionStatus,
            billingCycle: "monthly",
            date: toIso(gym.createdAt),
            periodEnd: toIso(gym.subscriptionExpiresAt),
          }] : [],
        },
      });
    }

    return res.json({
      success: true,
      data: {
        history: [
          ...payments.map((payment) => ({
            id: payment.id,
            type: "payment",
            amount: parseFloat(String(payment.amount || "0")) || 0,
            status: payment.status,
            date: toIso(payment.paidAt || payment.createdAt),
          })),
          ...subscriptions.map((subscription) => ({
            id: subscription.id,
            type: "subscription",
            planName: subscription.planName,
            amount: parseFloat(String(subscription.amount || "0")) || 0,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            date: toIso(subscription.createdAt),
            periodEnd: toIso(subscription.currentPeriodEnd),
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      },
    });
  } catch (error: any) {
    console.error("[BILLING HISTORY ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to fetch billing history", details: error.message });
  }
});

// ── Subscription audit logs ──────────────────────────────────────────────
router.get("/super-admin/subscription-audit-logs", superAdminOnly, async (_req, res) => {
  try {
    const gyms = await db
      .select({
        id: gymsTable.id,
        name: gymsTable.name,
        subscriptionStatus: gymsTable.subscriptionStatus,
        subscriptionTier: gymsTable.subscriptionTier,
        subscriptionExpiresAt: gymsTable.subscriptionExpiresAt,
        updatedAt: gymsTable.updatedAt,
        createdAt: gymsTable.createdAt,
      })
      .from(gymsTable)
      .orderBy(desc(gymsTable.updatedAt))
      .limit(20);

    return res.json({
      success: true,
      data: {
        logs: gyms.map((gym) => ({
          id: `audit-${gym.id}`,
          gymId: gym.id,
          gymName: gym.name,
          action: `Subscription ${getEffectiveStatus(gym.subscriptionStatus, gym.subscriptionExpiresAt)}`,
          details: `${gym.subscriptionTier || "basic"} plan, expires ${new Date(gym.subscriptionExpiresAt || gym.createdAt).toLocaleDateString()}`,
          actor: "Super Admin",
          createdAt: toIso(gym.updatedAt || gym.createdAt),
        })),
      },
    });
  } catch (error: any) {
    console.error("[SUBSCRIPTION AUDIT ERROR]", error);
    return res.status(500).json({ success: false, error: "Failed to fetch audit logs", details: error.message });
  }
});

// ── Get all subscription plans (for super admin dropdowns) ────────────────
router.get("/super-admin/plans", superAdminOnly, async (req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, true))
      .orderBy(subscriptionPlansTable.displayOrder);
    return res.json({ success: true, data: { plans } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch plans" });
  }
});

export default router;
