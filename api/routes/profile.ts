import { Router } from "express";
import { z } from "zod/v4";
import { hash, compare } from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../lib/db";
import { adminUsersTable } from "../../lib/db/src/schema";
import { protectedRoute, AuthenticatedRequest } from "../../lib/middleware/auth";
import { validate, asyncHandler, successResponse, UnauthorizedError, ValidationError } from "../../lib/middleware/error-handler";
import { createAuditLog, getRequestMetadata } from "../../lib/middleware/audit";
import { emailService } from "../../lib/services/email";

const router = Router();

/**
 * Validation Schemas
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  "/me",
  protectedRoute,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await db.query.adminUsersTable.findFirst({
      where: and(
        eq(adminUsersTable.id, req.user.userId),
        eq(adminUsersTable.isActive, true),
        isNull(adminUsersTable.deletedAt)
      ),
    });

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Get gym details if not super admin
    let gym = null;
    if (user.gymId) {
      gym = await db.query.gymsTable.findFirst({
        where: eq(db.query.gymsTable.id, user.gymId),
      });
    }

    res.json(
      successResponse({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          gymId: user.gymId,
          permissions: user.permissions,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        gym,
      })
    );
  })
);

/**
 * PATCH /api/auth/profile
 * Update user profile
 */
router.patch(
  "/profile",
  protectedRoute,
  validate(updateProfileSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { name, email } = req.body;

    // Get current user
    const currentUser = await db.query.adminUsersTable.findFirst({
      where: eq(adminUsersTable.id, req.user.userId),
    });

    if (!currentUser) {
      throw new UnauthorizedError("User not found");
    }

    // Check if email is being changed and already exists
    if (email && email !== currentUser.email) {
      const existingUser = await db.query.adminUsersTable.findFirst({
        where: and(
          eq(adminUsersTable.gymId, currentUser.gymId),
          eq(adminUsersTable.email, email),
          isNull(adminUsersTable.deletedAt)
        ),
      });

      if (existingUser) {
        throw new ValidationError("Email already in use");
      }
    }

    // Update user
    const updated = await db
      .update(adminUsersTable)
      .set({
        ...(name && { name }),
        ...(email && { email }),
        updatedBy: req.user.userId,
      })
      .where(eq(adminUsersTable.id, req.user.userId))
      .returning();

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "updated",
      entity: "admin_user",
      entityId: req.user.userId,
      changes: {
        before: {
          name: currentUser.name,
          email: currentUser.email,
        },
        after: {
          name: updated[0].name,
          email: updated[0].email,
        },
      },
      metadata: getRequestMetadata(req),
    });

    res.json(
      successResponse(
        {
          id: updated[0].id,
          name: updated[0].name,
          email: updated[0].email,
          role: updated[0].role,
        },
        "Profile updated successfully"
      )
    );
  })
);

/**
 * POST /api/auth/change-password
 * Change password for logged-in user
 */
router.post(
  "/change-password",
  protectedRoute,
  validate(changePasswordSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body;

    // Get user
    const user = await db.query.adminUsersTable.findFirst({
      where: eq(adminUsersTable.id, req.user.userId),
    });

    if (!user || !user.password) {
      throw new UnauthorizedError("User not found");
    }

    // Verify current password
    const isValidPassword = await compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 10);

    // Update password
    await db
      .update(adminUsersTable)
      .set({
        password: hashedPassword,
        updatedBy: req.user.userId,
      })
      .where(eq(adminUsersTable.id, req.user.userId));

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "updated",
      entity: "admin_user",
      entityId: req.user.userId,
      changes: {
        after: { password: "changed" },
      },
      metadata: getRequestMetadata(req),
    });

    // Send notification email
    await emailService.sendPasswordChangedEmail(user.email, user.name);

    res.json(
      successResponse(null, "Password changed successfully")
    );
  })
);

export default router;
