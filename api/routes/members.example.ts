import { Router } from "express";
import { z } from "zod/v4";
import { eq, and, like, desc } from "drizzle-orm";
import { db } from "../../db";
import { membersTable, memberHealthTable, memberNotesTable } from "../../db/src/schema";
import { protectedRoute, requirePermission } from "../../middleware/auth";
import { validate, asyncHandler, successResponse, NotFoundError } from "../../middleware/error-handler";
import { createAuditLog, getRequestMetadata } from "../../middleware/audit";
import { createQueryBuilder } from "../../utils/query-builder";
import { CodeGenerator, DateUtils, ValidationUtils } from "../../utils/helpers";
import { withTransaction } from "../../utils/transaction";
import { AuthenticatedRequest } from "../../middleware/auth";

const router = Router();

/**
 * Validation Schemas
 */
const createMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().refine(ValidationUtils.isValidPhone, "Invalid phone number"),
  whatsapp: z.string().optional(),
  email: z.string().email().optional(),
  gender: z.enum(["male", "female"]).default("male"),
  dob: z.string().optional(),
  cnic: z.string().refine(ValidationUtils.isValidCNIC, "Invalid CNIC format"),
  city: z.string().optional(),
  area: z.string().optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  fitnessGoal: z.string().default("general"),
  referralSource: z.string().optional(),
  photoUrl: z.string().url().optional(),
  plan: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  planStartDate: z.string(),
  assignedTrainerId: z.number().optional(),
});

const updateMemberSchema = createMemberSchema.partial();

const searchMembersSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["active", "expired", "frozen"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/members
 * List all members with pagination and search
 */
router.get(
  "/",
  protectedRoute,
  requirePermission("members", "read"),
  validate(searchMembersSchema, "query"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { query, status, page, limit } = req.query as any;
    const memberQuery = createQueryBuilder(membersTable, req.gymId);

    // Build where conditions
    let whereConditions = undefined;
    if (query) {
      whereConditions = like(membersTable.name, `%${query}%`);
    }
    if (status) {
      whereConditions = and(
        whereConditions,
        eq(membersTable.status, status)
      );
    }

    // Paginated query
    const result = await memberQuery.paginate({
      page,
      limit,
      where: whereConditions,
      orderBy: desc(membersTable.createdAt),
    });

    res.json(successResponse(result));
  })
);

/**
 * GET /api/members/:id
 * Get member details by ID
 */
router.get(
  "/:id",
  protectedRoute,
  requirePermission("members", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const memberId = parseInt(req.params.id);
    const memberQuery = createQueryBuilder(membersTable, req.gymId);

    const member = await memberQuery.findById(memberId);

    if (!member) {
      throw new NotFoundError("Member not found");
    }

    // Get related data
    const [health, notes] = await Promise.all([
      db.query.memberHealthTable.findFirst({
        where: and(
          eq(memberHealthTable.gymId, req.gymId),
          eq(memberHealthTable.memberId, memberId)
        ),
      }),
      db.query.memberNotesTable.findMany({
        where: and(
          eq(memberNotesTable.gymId, req.gymId),
          eq(memberNotesTable.memberId, memberId)
        ),
        orderBy: desc(memberNotesTable.createdAt),
        limit: 10,
      }),
    ]);

    res.json(
      successResponse({
        ...member,
        health,
        recentNotes: notes,
      })
    );
  })
);

/**
 * POST /api/members
 * Create a new member
 */
router.post(
  "/",
  protectedRoute,
  requirePermission("members", "create"),
  validate(createMemberSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = req.body;

    // Calculate expiry date
    const expiryDate = DateUtils.calculateExpiryDate(
      data.planStartDate,
      data.plan
    );

    // Create member in transaction
    const result = await withTransaction(async (tx) => {
      // Generate member code
      const memberCode = await CodeGenerator.generateMemberCode(req.gymId);

      // Create member
      const member = await tx
        .insert(membersTable)
        .values({
          gymId: req.gymId,
          memberCode,
          ...data,
          planExpiryDate: expiryDate,
          status: "active",
          createdBy: req.user.userId,
          updatedBy: req.user.userId,
        })
        .returning();

      // Create audit log
      await createAuditLog({
        gymId: req.gymId,
        userId: req.user.userId,
        userName: req.user.email,
        action: "created",
        entity: "member",
        entityId: member[0].id.toString(),
        changes: { after: member[0] },
        metadata: getRequestMetadata(req),
      });

      return member[0];
    });

    res.status(201).json(
      successResponse(result, "Member created successfully")
    );
  })
);

/**
 * PATCH /api/members/:id
 * Update member details
 */
router.patch(
  "/:id",
  protectedRoute,
  requirePermission("members", "update"),
  validate(updateMemberSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const memberId = parseInt(req.params.id);
    const updates = req.body;
    const memberQuery = createQueryBuilder(membersTable, req.gymId);

    // Get current state
    const before = await memberQuery.findById(memberId);
    if (!before) {
      throw new NotFoundError("Member not found");
    }

    // Update member
    const after = await memberQuery.updateById(
      memberId,
      updates,
      req.user.userId
    );

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "updated",
      entity: "member",
      entityId: memberId.toString(),
      changes: { before, after },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(after, "Member updated successfully"));
  })
);

/**
 * DELETE /api/members/:id
 * Soft delete a member
 */
router.delete(
  "/:id",
  protectedRoute,
  requirePermission("members", "delete"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const memberId = parseInt(req.params.id);
    const memberQuery = createQueryBuilder(membersTable, req.gymId);

    // Get current state
    const member = await memberQuery.findById(memberId);
    if (!member) {
      throw new NotFoundError("Member not found");
    }

    // Soft delete
    await memberQuery.softDeleteById(memberId, req.user.userId);

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "deleted",
      entity: "member",
      entityId: memberId.toString(),
      changes: { before: member },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(null, "Member deleted successfully"));
  })
);

/**
 * POST /api/members/:id/restore
 * Restore a soft-deleted member
 */
router.post(
  "/:id/restore",
  protectedRoute,
  requirePermission("members", "update"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const memberId = parseInt(req.params.id);
    const memberQuery = createQueryBuilder(membersTable, req.gymId);

    const member = await memberQuery.restoreById(memberId, req.user.userId);

    if (!member) {
      throw new NotFoundError("Member not found");
    }

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "restored",
      entity: "member",
      entityId: memberId.toString(),
      changes: { after: member },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(member, "Member restored successfully"));
  })
);

/**
 * GET /api/members/deleted
 * List soft-deleted members (for recovery)
 */
router.get(
  "/deleted/list",
  protectedRoute,
  requirePermission("members", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const memberQuery = createQueryBuilder(membersTable, req.gymId);
    const deletedMembers = await memberQuery.findDeleted();

    res.json(successResponse(deletedMembers));
  })
);

/**
 * GET /api/members/stats
 * Get member statistics
 */
router.get(
  "/stats/overview",
  protectedRoute,
  requirePermission("members", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const memberQuery = createQueryBuilder(membersTable, req.gymId);

    const [total, active, expired, frozen] = await Promise.all([
      memberQuery.count(),
      memberQuery.count(eq(membersTable.status, "active")),
      memberQuery.count(eq(membersTable.status, "expired")),
      memberQuery.count(eq(membersTable.status, "frozen")),
    ]);

    res.json(
      successResponse({
        total,
        active,
        expired,
        frozen,
      })
    );
  })
);

export default router;
