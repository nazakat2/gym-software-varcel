import { Router } from "express";
import Stripe from "stripe";
import { db } from "@workspace/db";
import {
  gymsTable,
  subscriptionsTable,
  subscriptionPlansTable,
  paymentHistoryTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { protectedRoute, AuthenticatedRequest } from "../../../lib/middleware/auth";

const router = Router();

// Initialize Stripe (lazy initialization to avoid module load errors)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: "2024-12-18.acacia",
}) : null;

// Helper to ensure Stripe is configured
function ensureStripe(): Stripe {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return stripe;
}

/**
 * @openapi
 * /billing/plans:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get available subscription plans
 *     description: Retrieve all active subscription plans with pricing and features
 *     responses:
 *       200:
 *         description: List of subscription plans
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get("/billing/plans", async (req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, true))
      .orderBy(subscriptionPlansTable.displayOrder);

    return res.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("[GET PLANS ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch subscription plans",
    });
  }
});

/**
 * @openapi
 * /billing/checkout:
 *   post:
 *     tags:
 *       - Billing
 *     summary: Create Stripe checkout session
 *     description: Create a checkout session to upgrade from trial to paid subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - billingCycle
 *             properties:
 *               planId:
 *                 type: string
 *                 description: Subscription plan ID
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               successUrl:
 *                 type: string
 *                 description: URL to redirect after successful payment
 *               cancelUrl:
 *                 type: string
 *                 description: URL to redirect if payment is canceled
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessionId:
 *                   type: string
 *                 url:
 *                   type: string
 */
router.post("/billing/checkout", protectedRoute, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { planId, billingCycle, successUrl, cancelUrl } = req.body;

    if (!planId || !billingCycle) {
      return res.status(400).json({
        success: false,
        error: "planId and billingCycle are required",
      });
    }

    // Get gym
    const [gym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.id, authReq.gymId));

    if (!gym) {
      return res.status(404).json({
        success: false,
        error: "Gym not found",
      });
    }

    // Get plan
    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId));

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Subscription plan not found",
      });
    }

    // Determine price based on billing cycle
    const priceId =
      billingCycle === "yearly"
        ? plan.stripeYearlyPriceId
        : plan.stripeMonthlyPriceId;

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: "Stripe price ID not configured for this plan",
      });
    }

    // Create or retrieve Stripe customer
    let customerId = gym.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: gym.email,
        name: gym.name,
        metadata: {
          gymId: gym.id,
        },
      });
      customerId = customer.id;

      // Update gym with Stripe customer ID
      await db
        .update(gymsTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(gymsTable.id, gym.id));
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${req.headers.origin}/dashboard?payment=success`,
      cancel_url: cancelUrl || `${req.headers.origin}/billing?payment=canceled`,
      metadata: {
        gymId: gym.id,
        planId: plan.id,
        billingCycle,
      },
    });

    return res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error("[CHECKOUT ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create checkout session",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /billing/subscription:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get current subscription
 *     description: Get the authenticated gym's current subscription details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 */
router.get("/billing/subscription", protectedRoute, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;

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
      .where(eq(subscriptionsTable.gymId, authReq.gymId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
      });
    }

    return res.json({
      success: true,
      subscription: subscription.subscription,
      plan: subscription.plan,
    });
  } catch (error) {
    console.error("[GET SUBSCRIPTION ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch subscription",
    });
  }
});

/**
 * @openapi
 * /billing/payment-history:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get payment history
 *     description: Get all payment transactions for the authenticated gym
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment history
 */
router.get("/billing/payment-history", protectedRoute, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const payments = await db
      .select()
      .from(paymentHistoryTable)
      .where(eq(paymentHistoryTable.gymId, authReq.gymId))
      .orderBy(desc(paymentHistoryTable.createdAt));

    return res.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("[GET PAYMENT HISTORY ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch payment history",
    });
  }
});

/**
 * @openapi
 * /billing/portal:
 *   post:
 *     tags:
 *       - Billing
 *     summary: Create billing portal session
 *     description: Create a Stripe billing portal session for managing subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               returnUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Portal session created
 */
router.post("/billing/portal", protectedRoute, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { returnUrl } = req.body;

    // Get gym
    const [gym] = await db
      .select()
      .from(gymsTable)
      .where(eq(gymsTable.id, authReq.gymId));

    if (!gym || !gym.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error: "No Stripe customer found for this gym",
      });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: gym.stripeCustomerId,
      return_url: returnUrl || `${req.headers.origin}/billing`,
    });

    return res.json({
      success: true,
      url: session.url,
    });
  } catch (error: any) {
    console.error("[BILLING PORTAL ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create billing portal session",
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /billing/cancel:
 *   post:
 *     tags:
 *       - Billing
 *     summary: Cancel subscription
 *     description: Cancel the current subscription (will remain active until period end)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription canceled
 */
router.post("/billing/cancel", protectedRoute, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;

    // Get current subscription
    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.gymId, authReq.gymId),
          eq(subscriptionsTable.status, "active")
        )
      )
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        error: "No active subscription found",
      });
    }

    // Cancel at period end in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update in database
    await db
      .update(subscriptionsTable)
      .set({
        cancelAtPeriodEnd: true,
        canceledAt: new Date().toISOString(),
      })
      .where(eq(subscriptionsTable.id, subscription.id));

    return res.json({
      success: true,
      message: "Subscription will be canceled at the end of the billing period",
    });
  } catch (error: any) {
    console.error("[CANCEL SUBSCRIPTION ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Failed to cancel subscription",
      details: error.message,
    });
  }
});

export default router;
