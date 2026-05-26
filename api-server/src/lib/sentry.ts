import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || "development";

  if (!sentryDsn) {
    console.warn("⚠️  SENTRY_DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,

    // Performance Monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Profiling
    profilesSampleRate: environment === "production" ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || "development",

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      // Remove sensitive query params
      if (event.request?.query_string) {
        const sensitiveParams = ["token", "password", "secret", "api_key"];
        sensitiveParams.forEach((param) => {
          if (event.request?.query_string?.includes(param)) {
            event.request.query_string = event.request.query_string.replace(
              new RegExp(`${param}=[^&]*`, "gi"),
              `${param}=[REDACTED]`
            );
          }
        });
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Browser errors
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      // Network errors
      "Network request failed",
      "Failed to fetch",
      // Common user errors
      "Invalid token",
      "Token expired",
    ],
  });

  console.log("✅ Sentry initialized for error tracking");
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext("additional", context);
  }
  Sentry.captureException(error);
}

/**
 * Capture message with level
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; gymId?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    gymId: user.gymId,
  });
}

/**
 * Clear user context
 */
export function clearUser() {
  Sentry.setUser(null);
}

export { Sentry };
