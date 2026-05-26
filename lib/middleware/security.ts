import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { Redis } from "ioredis";

/**
 * Redis client for rate limiting (optional)
 * Falls back to memory store if Redis is not available
 */
let redisClient: Redis | undefined;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
}

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient && {
    store: new RedisStore({
      client: redisClient,
      prefix: "rl:api:",
    }),
  }),
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later.",
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  ...(redisClient && {
    store: new RedisStore({
      client: redisClient,
      prefix: "rl:auth:",
    }),
  }),
});

/**
 * Rate limiter for expensive operations
 * 10 requests per hour per user
 */
export const expensiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: "Rate limit exceeded for this operation.",
  },
  keyGenerator: (req: Request) => {
    // Rate limit by user ID instead of IP
    const authReq = req as any;
    return authReq.user?.userId || req.ip || "anonymous";
  },
  ...(redisClient && {
    store: new RedisStore({
      client: redisClient,
      prefix: "rl:expensive:",
    }),
  }),
});

/**
 * Custom rate limiter factory
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: options.message || "Rate limit exceeded.",
    },
    keyGenerator: options.keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    ...(redisClient && {
      store: new RedisStore({
        client: redisClient,
        prefix: "rl:custom:",
      }),
    }),
  });
}

/**
 * Request size limiter
 * Prevents large payload attacks
 */
export function requestSizeLimiter(maxSizeInMB: number = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers["content-length"];

    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);

      if (sizeInMB > maxSizeInMB) {
        res.status(413).json({
          success: false,
          error: `Request payload too large. Maximum size: ${maxSizeInMB}MB`,
        });
        return;
      }
    }

    next();
  };
}

/**
 * IP Whitelist Middleware
 * Only allow requests from specific IPs
 */
export function ipWhitelist(allowedIPs: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.socket.remoteAddress;

    if (!clientIP || !allowedIPs.includes(clientIP)) {
      res.status(403).json({
        success: false,
        error: "Access denied from this IP address.",
      });
      return;
    }

    next();
  };
}

/**
 * CORS Configuration
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

/**
 * Security Headers Middleware
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );

  // HSTS (only in production)
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
}

/**
 * Example Usage:
 *
 * // Apply to all routes
 * app.use(apiLimiter);
 * app.use(securityHeaders);
 *
 * // Apply to specific routes
 * app.post("/api/auth/login", authLimiter, loginHandler);
 * app.post("/api/reports/generate", expensiveOperationLimiter, generateReportHandler);
 *
 * // Custom rate limiter
 * const uploadLimiter = createRateLimiter({
 *   windowMs: 60 * 60 * 1000, // 1 hour
 *   max: 50,
 *   message: "Too many uploads, please try again later.",
 * });
 * app.post("/api/upload", uploadLimiter, uploadHandler);
 */
