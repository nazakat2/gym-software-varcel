import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * JWT Payload Structure
 */
export interface JwtPayload {
  userId: string;
  gymId: string | null; // null for super_admin
  role: "super_admin" | "gym_owner" | "manager" | "receptionist" | "trainer" | "staff";
  email: string;
  permissions?: {
    members?: string[];
    billing?: string[];
    attendance?: string[];
    reports?: string[];
    inventory?: string[];
    settings?: string[];
  };
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  gymId: string; // Always set (from user.gymId or query param for super_admin)
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "No token provided",
      });
      return;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET not configured");
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // Attach user to request
    (req as AuthenticatedRequest).user = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
}

/**
 * Multi-Tenant Context Middleware
 * Ensures gymId is set for all requests
 * Super admins can specify gymId via query param
 */
export function setGymContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
    });
    return;
  }

  // Super admin can specify gymId via query param
  if (authReq.user.role === "super_admin") {
    const gymIdParam = req.query.gymId as string;

    if (!gymIdParam) {
      res.status(400).json({
        success: false,
        error: "Super admin must specify gymId query parameter",
      });
      return;
    }

    authReq.gymId = gymIdParam;
  } else {
    // Regular users use their assigned gymId
    if (!authReq.user.gymId) {
      res.status(403).json({
        success: false,
        error: "User not assigned to any gym",
      });
      return;
    }

    authReq.gymId = authReq.user.gymId;
  }

  next();
}

/**
 * Role-Based Access Control Middleware
 */
export function requireRole(...allowedRoles: JwtPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}

/**
 * Permission-Based Access Control Middleware
 */
export function requirePermission(
  resource: keyof NonNullable<JwtPayload["permissions"]>,
  action: string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    // Super admin has all permissions
    if (authReq.user.role === "super_admin") {
      next();
      return;
    }

    // Check granular permissions
    const userPermissions = authReq.user.permissions?.[resource] || [];

    if (!userPermissions.includes(action) && !userPermissions.includes("*")) {
      res.status(403).json({
        success: false,
        error: `Missing permission: ${resource}.${action}`,
      });
      return;
    }

    next();
  };
}

/**
 * Combine authentication and gym context
 * Use this as the default middleware for all protected routes
 */
export const protectedRoute = [authenticate, setGymContext];

/**
 * Example Usage:
 *
 * // Basic authentication
 * app.get("/api/members", protectedRoute, getMembersHandler);
 *
 * // Role-based access
 * app.post("/api/members", protectedRoute, requireRole("gym_owner", "manager"), createMemberHandler);
 *
 * // Permission-based access
 * app.delete("/api/members/:id", protectedRoute, requirePermission("members", "delete"), deleteMemberHandler);
 */
