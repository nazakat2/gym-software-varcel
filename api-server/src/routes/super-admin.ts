import { Router } from "express";
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
    // Total gyms
    const [{ count: totalGyms }] = await db
      .select({ count: count() })
      .from(gymsTable);

    // Active gyms
    const [{ count: activeGyms }] = await db
      .select({ count: count() })
      .from(gymsTable)
      .where(eq(gymsTable.isActive, true));

    // Total subscriptions
    const [{ count: totalSubscriptions }] = await db
      .select({ count: count() })
      .from(subscriptionsTable);

    // Active subscriptions
    const [{ count: activeSubscriptions }] = await db
      .select({ count: count() })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active"));

    // Calculate MRR (Monthly Recurring Revenue)
    const activeMonthlySubscriptions = await db
      .select({
        amount: subscriptionsTable.amount,
        billingCycle: subscriptionsTable.billingCycle,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active"));

    let mrr = 0;
    activeMonthlySubscriptions.forEach((sub) => {
      const amount = parseFloat(sub.amount);
      if (sub.billingCycle === "monthly") {
        mrr += amount;
      } else if (sub.billingCycle === "yearly") {
        mrr += amount / 12; // Convert yearly to monthly
      }
    });

    // Total revenue (all successful payments)
    const [{ total: totalRevenue }] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentHistoryTable.amount} AS DECIMAL)), 0)`,
      })
      .from(paymentHistoryTable)
      .where(eq(paymentHistoryTable.status, "succeeded"));

    // Recent gyms (last 5)
    const recentGyms = await db
      .select({
        id: gymsTable.id,
        name: gymsTable.name,
        email: gymsTable.email,
        subscriptionStatus: gymsTable.subscriptionStatus,
        subscriptionTier: gymsTable.subscriptionTier,
        createdAt: gymsTable.createdAt,
      })
      .from(gymsTable)
      .orderBy(desc(gymsTable.createdAt))
      .limit(5);

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

    return res.json({
      success: true,
      data: {
        stats: {
          totalGyms: Number(totalGyms),
          activeGyms: Number(activeGyms),
          totalSubscriptions: Number(totalSubscriptions),
          activeSubscriptions: Number(activeSubscriptions),
          mrr: Math.round(mrr),
          totalRevenue: parseFloat(totalRevenue || "0"),
        },
        recentGyms,
        recentPayments,
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
    const gyms = await db
      .select({
        id: gymsTable.id,
        name: gymsTable.name,
        email: gymsTable.email,
        phone: gymsTable.phone,
        address: gymsTable.address,
        city: gymsTable.city,
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const planId = req.query.planId as string;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(subscriptionsTable.status, status));
    }
    if (planId) {
      conditions.push(eq(subscriptionsTable.planId, planId));
    }

    // Get subscriptions with gym and plan info
    const subscriptions = await db
      .select({
        subscription: subscriptionsTable,
        gym: {
          id: gymsTable.id,
          name: gymsTable.name,
          email: gymsTable.email,
        },
        plan: {
          id: subscriptionPlansTable.id,
          name: subscriptionPlansTable.name,
          slug: subscriptionPlansTable.slug,
        },
      })
      .from(subscriptionsTable)
      .leftJoin(gymsTable, eq(subscriptionsTable.gymId, gymsTable.id))
      .leftJoin(
        subscriptionPlansTable,
        eq(subscriptionsTable.planId, subscriptionPlansTable.id)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(subscriptionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return res.json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          page,
          limit,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / limit),
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

export default router;
