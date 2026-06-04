import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { db } from "@workspace/db";
import {
  gymsTable,
  subscriptionsTable,
  subscriptionPlansTable,
  paymentHistoryTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { EmailService } from "../services/email.service";
import { SMSService } from "../services/sms.service";
import { WhatsAppService } from "../services/whatsapp.service";

const router = Router();

// Initialize Stripe (lazy initialization to avoid module load errors)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
 * /webhooks/stripe:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Stripe webhook handler
 *     description: Handle Stripe webhook events (payment success, subscription updates, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook signature
 */
router.post(
  "/webhooks/stripe",
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      res.status(400).json({ error: "No signature provided" });
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecret
        );
      } else {
        // For testing without webhook secret
        event = req.body as Stripe.Event;
        console.warn("[STRIPE WEBHOOK] No webhook secret configured - skipping signature verification");
      }
    } catch (err: any) {
      console.error("[STRIPE WEBHOOK] Signature verification failed:", err.message);
      res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      return;
    }

    console.log(`[STRIPE WEBHOOK] Received event: ${event.type}`);

    try {
      // Handle different event types
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error(`[STRIPE WEBHOOK] Error processing ${event.type}:`, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log("[STRIPE] Checkout session completed:", session.id);

  const gymId = session.metadata?.gymId;
  const planId = session.metadata?.planId;
  const billingCycle = session.metadata?.billingCycle;

  if (!gymId || !planId) {
    console.error("[STRIPE] Missing metadata in checkout session");
    return;
  }

  // Get subscription from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // Get plan details
  const [plan] = await db
    .select()
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, planId));

  if (!plan) {
    console.error("[STRIPE] Plan not found:", planId);
    return;
  }

  // Create subscription record
  await db.insert(subscriptionsTable).values({
    gymId,
    planId,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: stripeSubscription.customer as string,
    status: "active",
    billingCycle: billingCycle || "monthly",
    amount: billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice,
    currency: "PKR",
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
  });

  // Update gym subscription status
  await db
    .update(gymsTable)
    .set({
      subscriptionStatus: "active",
      subscriptionTier: plan.slug,
      subscriptionExpiresAt: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    })
    .where(eq(gymsTable.id, gymId));

  console.log("[STRIPE] Subscription created for gym:", gymId);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("[STRIPE] Invoice payment succeeded:", invoice.id);

  const gymId = invoice.metadata?.gymId || (await getGymIdFromCustomer(invoice.customer as string));

  if (!gymId) {
    console.error("[STRIPE] Could not determine gym ID from invoice");
    return;
  }

  // Get subscription
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, invoice.subscription as string))
    .limit(1);

  // Record payment
  await db.insert(paymentHistoryTable).values({
    gymId,
    subscriptionId: subscription?.id || null,
    stripePaymentIntentId: invoice.payment_intent as string,
    stripeInvoiceId: invoice.id,
    stripeChargeId: invoice.charge as string,
    amount: (invoice.amount_paid / 100).toString(),
    currency: invoice.currency.toUpperCase(),
    status: "succeeded",
    description: invoice.description || "Subscription payment",
    invoiceUrl: invoice.hosted_invoice_url || null,
    paidAt: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
  });

  // Get gym and plan details for email
  const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId)).limit(1);
  const [plan] = subscription
    ? await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, subscription.planId)).limit(1)
    : [null];

  // Send payment success email
  if (gym && plan) {
    EmailService.sendPaymentSuccessEmail(
      gym.email,
      gym.name,
      invoice.amount_paid / 100,
      plan.name,
      subscription?.billingCycle || "monthly"
    ).catch((err) => console.error("Failed to send payment success email:", err));

    // Send SMS notification if phone number available
    if (gym.phone) {
      SMSService.sendPaymentSuccessSMS(
        gym.phone,
        gym.name,
        invoice.amount_paid / 100
      ).catch((err) => console.error("Failed to send payment success SMS:", err));

      // Send WhatsApp notification
      WhatsAppService.sendPaymentSuccessMessage(
        gym.phone,
        gym.name,
        invoice.amount_paid / 100,
        plan.name
      ).catch((err) => console.error("Failed to send payment success WhatsApp:", err));
    }
  }

  console.log("[STRIPE] Payment recorded for gym:", gymId);
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("[STRIPE] Invoice payment failed:", invoice.id);

  const gymId = invoice.metadata?.gymId || (await getGymIdFromCustomer(invoice.customer as string));

  if (!gymId) {
    console.error("[STRIPE] Could not determine gym ID from invoice");
    return;
  }

  // Get subscription
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, invoice.subscription as string))
    .limit(1);

  // Record failed payment
  await db.insert(paymentHistoryTable).values({
    gymId,
    subscriptionId: subscription?.id || null,
    stripePaymentIntentId: invoice.payment_intent as string,
    stripeInvoiceId: invoice.id,
    amount: (invoice.amount_due / 100).toString(),
    currency: invoice.currency.toUpperCase(),
    status: "failed",
    description: invoice.description || "Subscription payment",
    failedAt: new Date().toISOString(),
    failureReason: "payment_failed",
    failureMessage: "Payment failed",
  });

  // Update subscription status
  if (subscription) {
    await db
      .update(subscriptionsTable)
      .set({ status: "past_due" })
      .where(eq(subscriptionsTable.id, subscription.id));
  }

  // Update gym status
  await db
    .update(gymsTable)
    .set({ subscriptionStatus: "past_due" })
    .where(eq(gymsTable.id, gymId));

  // Get gym details for email
  const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId)).limit(1);

  // Send payment failure email
  if (gym) {
    EmailService.sendPaymentFailureEmail(
      gym.email,
      gym.name,
      "Payment method declined or insufficient funds"
    ).catch((err) => console.error("Failed to send payment failure email:", err));

    // Send SMS notification if phone number available
    if (gym.phone) {
      SMSService.sendPaymentFailureSMS(gym.phone, gym.name).catch((err) =>
        console.error("Failed to send payment failure SMS:", err)
      );

      // Send WhatsApp notification
      WhatsAppService.sendPaymentFailureMessage(gym.phone, gym.name).catch((err) =>
        console.error("Failed to send payment failure WhatsApp:", err)
      );
    }
  }

  console.log("[STRIPE] Failed payment recorded for gym:", gymId);
}

/**
 * Handle subscription update
 */
async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  console.log("[STRIPE] Subscription updated:", stripeSubscription.id);

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscription.id))
    .limit(1);

  if (!subscription) {
    console.error("[STRIPE] Subscription not found:", stripeSubscription.id);
    return;
  }

  // Update subscription
  await db
    .update(subscriptionsTable)
    .set({
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    })
    .where(eq(subscriptionsTable.id, subscription.id));

  // Update gym
  await db
    .update(gymsTable)
    .set({
      subscriptionStatus: stripeSubscription.status,
      subscriptionExpiresAt: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    })
    .where(eq(gymsTable.id, subscription.gymId));

  console.log("[STRIPE] Subscription updated for gym:", subscription.gymId);
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  console.log("[STRIPE] Subscription deleted:", stripeSubscription.id);

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscription.id))
    .limit(1);

  if (!subscription) {
    console.error("[STRIPE] Subscription not found:", stripeSubscription.id);
    return;
  }

  // Update subscription
  await db
    .update(subscriptionsTable)
    .set({
      status: "canceled",
      canceledAt: new Date().toISOString(),
    })
    .where(eq(subscriptionsTable.id, subscription.id));

  // Update gym
  await db
    .update(gymsTable)
    .set({ subscriptionStatus: "canceled" })
    .where(eq(gymsTable.id, subscription.gymId));

  // Get gym details for email
  const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, subscription.gymId)).limit(1);

  // Send subscription cancelled email
  if (gym) {
    EmailService.sendSubscriptionCancelledEmail(
      gym.email,
      gym.name,
      gym.subscriptionExpiresAt || new Date().toISOString()
    ).catch((err) => console.error("Failed to send subscription cancelled email:", err));

    // Send SMS notification if phone number available
    if (gym.phone) {
      SMSService.sendSubscriptionCancelledSMS(
        gym.phone,
        gym.name,
        gym.subscriptionExpiresAt || new Date().toISOString()
      ).catch((err) => console.error("Failed to send subscription cancelled SMS:", err));

      // Send WhatsApp notification
      WhatsAppService.sendSubscriptionCancelledMessage(
        gym.phone,
        gym.name,
        gym.subscriptionExpiresAt || new Date().toISOString()
      ).catch((err) => console.error("Failed to send subscription cancelled WhatsApp:", err));
    }
  }

  console.log("[STRIPE] Subscription canceled for gym:", subscription.gymId);
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("[STRIPE] Payment intent succeeded:", paymentIntent.id);
  // Payment is already recorded via invoice.payment_succeeded
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("[STRIPE] Payment intent failed:", paymentIntent.id);
  // Failure is already recorded via invoice.payment_failed
}

/**
 * Helper: Get gym ID from Stripe customer ID
 */
async function getGymIdFromCustomer(customerId: string): Promise<string | null> {
  const [gym] = await db
    .select()
    .from(gymsTable)
    .where(eq(gymsTable.stripeCustomerId, customerId))
    .limit(1);

  return gym?.id || null;
}

export default router;
