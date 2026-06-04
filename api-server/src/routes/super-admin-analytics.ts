import { Router } from "express";
import { db } from "@workspace/db";
import {
  gymsTable,
  subscriptionsTable,
  subscriptionPlansTable,
  paymentHistoryTable,
} from "@workspace/db";
import { eq, desc, count, sql, and, gte, lte } from "drizzle-orm";
import { authenticate, requireRole } from "../../../lib/middleware/auth";

const router = Router();

// Middleware: Require super_admin role (no gym context needed for platform-wide analytics)
const superAdminOnly = [authenticate, requireRole("super_admin")];

/**
 * @openapi
 * /super-admin/analytics/revenue:
 *   get:
 *     tags:
 *       - Super Admin Analytics
 *     summary: Get revenue over time
 *     description: Get revenue data for charts (daily, weekly, monthly)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year]
 *           default: 30days
 *     responses:
 *       200:
 *         description: Revenue data
 */
router.get("/super-admin/analytics/revenue", superAdminOnly, async (req, res) => {
  try {
    const period = (req.query.period as string) || "30days";

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case "7days":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30days":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90days":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get revenue grouped by date
    const revenueData = await db
      .select({
        date: sql<string>`DATE(${paymentHistoryTable.paidAt})`,
        revenue: sql<string>`SUM(CAST(${paymentHistoryTable.amount} AS DECIMAL))`,
        count: count(),
      })
      .from(paymentHistoryTable)
      .where(
        and(
          eq(paymentHistoryTable.status, "succeeded"),
          gte(paymentHistoryTable.paidAt, startDate)
        )
      )
      .groupBy(sql`DATE(${paymentHistoryTable.paidAt})`)
      .orderBy(sql`DATE(${paymentHistoryTable.paidAt})`);

    return res.json({
      success: true,
      period,
      data: revenueData.map((row) => ({
        date: row.date,
        revenue: parseFloat(row.revenue || "0"),
        count: Number(row.count),
      })),
    });
  } catch (error: any) {
    console.error("[REVENUE ANALYTICS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch revenue analytics",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/analytics/subscriptions:
 *   get:
 *     tags:
 *       - Super Admin Analytics
 *     summary: Get subscription distribution
 *     description: Get subscription counts by plan and status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription distribution
 */
router.get("/super-admin/analytics/subscriptions", superAdminOnly, async (req, res) => {
  try {
    // Subscriptions by plan
    const byPlan = await db
      .select({
        planId: subscriptionsTable.planId,
        planName: subscriptionPlansTable.name,
        planSlug: subscriptionPlansTable.slug,
        count: count(),
      })
      .from(subscriptionsTable)
      .leftJoin(
        subscriptionPlansTable,
        eq(subscriptionsTable.planId, subscriptionPlansTable.id)
      )
      .groupBy(subscriptionsTable.planId, subscriptionPlansTable.name, subscriptionPlansTable.slug);

    // Subscriptions by status
    const byStatus = await db
      .select({
        status: subscriptionsTable.status,
        count: count(),
      })
      .from(subscriptionsTable)
      .groupBy(subscriptionsTable.status);

    // Subscriptions by billing cycle
    const byBillingCycle = await db
      .select({
        billingCycle: subscriptionsTable.billingCycle,
        count: count(),
      })
      .from(subscriptionsTable)
      .groupBy(subscriptionsTable.billingCycle);

    return res.json({
      success: true,
      data: {
        byPlan: byPlan.map((row) => ({
          planId: row.planId,
          planName: row.planName,
          planSlug: row.planSlug,
          count: Number(row.count),
        })),
        byStatus: byStatus.map((row) => ({
          status: row.status,
          count: Number(row.count),
        })),
        byBillingCycle: byBillingCycle.map((row) => ({
          billingCycle: row.billingCycle,
          count: Number(row.count),
        })),
      },
    });
  } catch (error: any) {
    console.error("[SUBSCRIPTION ANALYTICS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch subscription analytics",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/analytics/gym-growth:
 *   get:
 *     tags:
 *       - Super Admin Analytics
 *     summary: Get gym growth over time
 *     description: Get gym registration data over time
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [30days, 90days, 1year]
 *           default: 90days
 *     responses:
 *       200:
 *         description: Gym growth data
 */
router.get("/super-admin/analytics/gym-growth", superAdminOnly, async (req, res) => {
  try {
    const period = (req.query.period as string) || "90days";

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case "30days":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90days":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get gym registrations grouped by date
    const growthData = await db
      .select({
        date: sql<string>`DATE(${gymsTable.createdAt})`,
        count: count(),
      })
      .from(gymsTable)
      .where(gte(gymsTable.createdAt, startDate))
      .groupBy(sql`DATE(${gymsTable.createdAt})`)
      .orderBy(sql`DATE(${gymsTable.createdAt})`);

    // Calculate cumulative count
    let cumulative = 0;
    const dataWithCumulative = growthData.map((row) => {
      cumulative += Number(row.count);
      return {
        date: row.date,
        newGyms: Number(row.count),
        totalGyms: cumulative,
      };
    });

    return res.json({
      success: true,
      period,
      data: dataWithCumulative,
    });
  } catch (error: any) {
    console.error("[GYM GROWTH ANALYTICS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch gym growth analytics",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/analytics/payment-stats:
 *   get:
 *     tags:
 *       - Super Admin Analytics
 *     summary: Get payment statistics
 *     description: Get payment success/failure rates and trends
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment statistics
 */
router.get("/super-admin/analytics/payment-stats", superAdminOnly, async (req, res) => {
  try {
    // Payment counts by status
    const byStatus = await db
      .select({
        status: paymentHistoryTable.status,
        count: count(),
        totalAmount: sql<string>`SUM(CAST(${paymentHistoryTable.amount} AS DECIMAL))`,
      })
      .from(paymentHistoryTable)
      .groupBy(paymentHistoryTable.status);

    // Calculate success rate
    const totalPayments = byStatus.reduce((sum, row) => sum + Number(row.count), 0);
    const successfulPayments = byStatus.find((row) => row.status === "succeeded");
    const successRate = totalPayments > 0
      ? (Number(successfulPayments?.count || 0) / totalPayments) * 100
      : 0;

    // Recent failed payments (for investigation)
    const recentFailures = await db
      .select({
        id: paymentHistoryTable.id,
        gymId: paymentHistoryTable.gymId,
        amount: paymentHistoryTable.amount,
        failureReason: paymentHistoryTable.failureReason,
        failureMessage: paymentHistoryTable.failureMessage,
        failedAt: paymentHistoryTable.failedAt,
        gym: {
          name: gymsTable.name,
          email: gymsTable.email,
        },
      })
      .from(paymentHistoryTable)
      .leftJoin(gymsTable, eq(paymentHistoryTable.gymId, gymsTable.id))
      .where(eq(paymentHistoryTable.status, "failed"))
      .orderBy(desc(paymentHistoryTable.failedAt))
      .limit(10);

    return res.json({
      success: true,
      data: {
        byStatus: byStatus.map((row) => ({
          status: row.status,
          count: Number(row.count),
          totalAmount: parseFloat(row.totalAmount || "0"),
        })),
        successRate: Math.round(successRate * 100) / 100,
        totalPayments,
        recentFailures,
      },
    });
  } catch (error: any) {
    console.error("[PAYMENT STATS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch payment statistics",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /super-admin/analytics/top-gyms:
 *   get:
 *     tags:
 *       - Super Admin Analytics
 *     summary: Get top performing gyms
 *     description: Get gyms ranked by revenue, members, or activity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [revenue, members]
 *           default: revenue
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top gyms
 */
router.get("/super-admin/analytics/top-gyms", superAdminOnly, async (req, res) => {
  try {
    const metric = (req.query.metric as string) || "revenue";
    const limit = parseInt(req.query.limit as string) || 10;

    if (metric === "revenue") {
      // Top gyms by revenue
      const topGyms = await db
        .select({
          gymId: paymentHistoryTable.gymId,
          gym: {
            id: gymsTable.id,
            name: gymsTable.name,
            email: gymsTable.email,
            subscriptionTier: gymsTable.subscriptionTier,
          },
          totalRevenue: sql<string>`SUM(CAST(${paymentHistoryTable.amount} AS DECIMAL))`,
          paymentCount: count(),
        })
        .from(paymentHistoryTable)
        .leftJoin(gymsTable, eq(paymentHistoryTable.gymId, gymsTable.id))
        .where(eq(paymentHistoryTable.status, "succeeded"))
        .groupBy(paymentHistoryTable.gymId, gymsTable.id, gymsTable.name, gymsTable.email, gymsTable.subscriptionTier)
        .orderBy(desc(sql`SUM(CAST(${paymentHistoryTable.amount} AS DECIMAL))`))
        .limit(limit);

      return res.json({
        success: true,
        data: {
          metric: "revenue",
          gyms: topGyms.map((row) => ({
            ...row.gym,
            totalRevenue: parseFloat(row.totalRevenue || "0"),
            paymentCount: Number(row.paymentCount),
          })),
        },
      });
    }

    return res.json({
      success: true,
      data: {
        metric,
        gyms: [],
      },
    });
  } catch (error: any) {
    console.error("[TOP GYMS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch top gyms",
      details: error.message,
    });
  }
});

export default router;
