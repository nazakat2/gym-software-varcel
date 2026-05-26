import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gymRouter from "./gym";
import gymAdminRouter from "./gym-admin";
import chatbotRouter from "./chatbot";
import swaggerRouter from "./swagger";
import dashboardRouter from "./dashboard";
import gymOnboardingRouter from "./gym-onboarding";
import billingRouter from "./billing";
import stripeWebhookRouter from "./stripe-webhook";
import superAdminRouter from "./super-admin";
import superAdminAnalyticsRouter from "./super-admin-analytics";
import cronRouter from "./cron";
import {
  globalLimiter,
  registrationLimiter,
  paymentLimiter,
  superAdminLimiter,
} from "../middleware/rate-limit";

const router: IRouter = Router();

// Routes that bypass global rate limiter
router.use(swaggerRouter);
router.use(healthRouter);

// Cron jobs (protected by CRON_SECRET, no rate limiting needed)
router.use(cronRouter);

// Stripe webhooks (NO rate limiting - must accept all webhook calls)
router.use(stripeWebhookRouter);

// Super admin routes with their own higher limits (bypass global limiter)
router.use(superAdminLimiter, superAdminRouter);
router.use(superAdminLimiter, superAdminAnalyticsRouter);

// Apply global rate limiter to remaining routes
router.use(globalLimiter);

router.use(chatbotRouter);
router.use("/dashboard", dashboardRouter);

// Public onboarding routes with stricter rate limiting
router.use(registrationLimiter, gymOnboardingRouter);

// Billing & subscription routes with payment rate limiting
router.use(paymentLimiter, billingRouter);

// Regular gym routes
router.use(gymAdminRouter);
router.use(gymRouter);

export default router;
