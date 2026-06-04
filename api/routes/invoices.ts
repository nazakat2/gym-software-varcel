import { Router } from "express";
import { z } from "zod/v4";
import { eq, and, desc, between, sql, isNull } from "drizzle-orm";
import { db } from "../../lib/db";
import { invoicesTable, membersTable, employeesTable } from "../../lib/db/src/schema";
import { protectedRoute, requirePermission, AuthenticatedRequest } from "../../lib/middleware/auth";
import { validate, asyncHandler, successResponse, NotFoundError, ValidationError } from "../../lib/middleware/error-handler";
import { createAuditLog, getRequestMetadata } from "../../lib/middleware/audit";
import { createQueryBuilder } from "../../utils/query-builder";
import { CodeGenerator, DateUtils, CurrencyUtils } from "../../utils/helpers";
import { withTransaction } from "../../utils/transaction";

const router = Router();

/**
 * Validation Schemas
 */
const createInvoiceSchema = z.object({
  memberId: z.number().int().positive("Invalid member ID"),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  plan: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "upi"]).optional(),
  trainerId: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

const searchInvoicesSchema = z.object({
  memberId: z.coerce.number().int().positive().optional(),
  status: z.enum(["unpaid", "paid", "overdue", "cancelled"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const payInvoiceSchema = z.object({
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "upi"]),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/invoices
 * List all invoices with pagination and filters
 */
router.get(
  "/",
  protectedRoute,
  requirePermission("billing", "read"),
  validate(searchInvoicesSchema, "query"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { memberId, status, startDate, endDate, page, limit } = req.query as any;
    const invoiceQuery = createQueryBuilder(invoicesTable, req.gymId);

    // Build where conditions
    let whereConditions = undefined;

    if (memberId) {
      whereConditions = and(whereConditions, eq(invoicesTable.memberId, memberId));
    }

    if (status) {
      whereConditions = and(whereConditions, eq(invoicesTable.status, status));
    }

    if (startDate && endDate) {
      whereConditions = and(
        whereConditions,
        between(invoicesTable.dueDate, startDate, endDate)
      );
    }

    // Paginated query with member details
    const result = await db
      .select({
        invoice: invoicesTable,
        member: {
          id: membersTable.id,
          name: membersTable.name,
          memberCode: membersTable.memberCode,
          phone: membersTable.phone,
        },
      })
      .from(invoicesTable)
      .leftJoin(membersTable, eq(invoicesTable.memberId, membersTable.id))
      .where(
        and(
          eq(invoicesTable.gymId, req.gymId),
          isNull(invoicesTable.deletedAt),
          whereConditions
        )
      )
      .orderBy(desc(invoicesTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.gymId, req.gymId),
          isNull(invoicesTable.deletedAt),
          whereConditions
        )
      );

    const total = totalResult[0]?.count || 0;

    res.json(
      successResponse({
        data: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      })
    );
  })
);

/**
 * GET /api/invoices/:id
 * Get invoice details by ID
 */
router.get(
  "/:id",
  protectedRoute,
  requirePermission("billing", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const invoiceId = parseInt(req.params.id);

    const result = await db
      .select({
        invoice: invoicesTable,
        member: membersTable,
        trainer: employeesTable,
      })
      .from(invoicesTable)
      .leftJoin(membersTable, eq(invoicesTable.memberId, membersTable.id))
      .leftJoin(employeesTable, eq(invoicesTable.trainerId, employeesTable.id))
      .where(
        and(
          eq(invoicesTable.id, invoiceId),
          eq(invoicesTable.gymId, req.gymId),
          isNull(invoicesTable.deletedAt)
        )
      )
      .limit(1);

    if (!result.length) {
      throw new NotFoundError("Invoice not found");
    }

    res.json(successResponse(result[0]));
  })
);

/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post(
  "/",
  protectedRoute,
  requirePermission("billing", "create"),
  validate(createInvoiceSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { memberId, amount, plan, dueDate, paymentMethod, trainerId, notes } = req.body;

    // Verify member exists
    const member = await db.query.membersTable.findFirst({
      where: and(
        eq(membersTable.id, memberId),
        eq(membersTable.gymId, req.gymId),
        isNull(membersTable.deletedAt)
      ),
    });

    if (!member) {
      throw new NotFoundError("Member not found");
    }

    // Verify trainer exists (if provided)
    if (trainerId) {
      const trainer = await db.query.employeesTable.findFirst({
        where: and(
          eq(employeesTable.id, trainerId),
          eq(employeesTable.gymId, req.gymId),
          isNull(employeesTable.deletedAt)
        ),
      });

      if (!trainer) {
        throw new NotFoundError("Trainer not found");
      }
    }

    // Create invoice in transaction
    const result = await withTransaction(async (tx) => {
      // Generate invoice number
      const invoiceNumber = await CodeGenerator.generateInvoiceNumber(req.gymId);

      // Calculate trainer commission if trainer assigned
      let trainerCommission = null;
      let gymRevenue = amount;

      if (trainerId) {
        const trainer = await tx.query.employeesTable.findFirst({
          where: eq(employeesTable.id, trainerId),
        });

        if (trainer && trainer.commissionPercentage) {
          const commission = CurrencyUtils.calculateCommission(
            parseFloat(amount),
            parseFloat(trainer.commissionPercentage),
            "percentage"
          );
          trainerCommission = commission.commission.toString();
          gymRevenue = commission.gymRevenue.toString();
        }
      }

      // Create invoice
      const invoice = await tx
        .insert(invoicesTable)
        .values({
          gymId: req.gymId,
          invoiceNumber,
          memberId,
          amount,
          plan,
          dueDate,
          paymentMethod,
          trainerId,
          trainerCommission,
          gymRevenue,
          notes,
          status: "unpaid",
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
        entity: "invoice",
        entityId: invoice[0].id.toString(),
        changes: { after: invoice[0] },
        metadata: getRequestMetadata(req),
      });

      return invoice[0];
    });

    res.status(201).json(
      successResponse(result, "Invoice created successfully")
    );
  })
);

/**
 * PATCH /api/invoices/:id
 * Update invoice details
 */
router.patch(
  "/:id",
  protectedRoute,
  requirePermission("billing", "update"),
  validate(updateInvoiceSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const invoiceId = parseInt(req.params.id);
    const updates = req.body;
    const invoiceQuery = createQueryBuilder(invoicesTable, req.gymId);

    // Get current invoice
    const before = await invoiceQuery.findById(invoiceId);
    if (!before) {
      throw new NotFoundError("Invoice not found");
    }

    // Don't allow updating paid invoices
    if (before.status === "paid") {
      throw new ValidationError("Cannot update paid invoice");
    }

    // Update invoice
    const after = await invoiceQuery.updateById(
      invoiceId,
      updates,
      req.user.userId
    );

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "updated",
      entity: "invoice",
      entityId: invoiceId.toString(),
      changes: { before, after },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(after, "Invoice updated successfully"));
  })
);

/**
 * POST /api/invoices/:id/pay
 * Mark invoice as paid
 */
router.post(
  "/:id/pay",
  protectedRoute,
  requirePermission("billing", "update"),
  validate(payInvoiceSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const invoiceId = parseInt(req.params.id);
    const { paymentMethod, paidDate, notes } = req.body;

    const result = await withTransaction(async (tx) => {
      // Get invoice
      const invoice = await tx.query.invoicesTable.findFirst({
        where: and(
          eq(invoicesTable.id, invoiceId),
          eq(invoicesTable.gymId, req.gymId),
          isNull(invoicesTable.deletedAt)
        ),
      });

      if (!invoice) {
        throw new NotFoundError("Invoice not found");
      }

      if (invoice.status === "paid") {
        throw new ValidationError("Invoice already paid");
      }

      // Update invoice
      const updated = await tx
        .update(invoicesTable)
        .set({
          status: "paid",
          paymentMethod,
          paidDate: paidDate || DateUtils.getCurrentDate(),
          notes: notes || invoice.notes,
          updatedBy: req.user.userId,
        })
        .where(eq(invoicesTable.id, invoiceId))
        .returning();

      // If trainer commission exists, record it
      if (invoice.trainerId && invoice.trainerCommission) {
        await tx.insert(db.query.trainerEarningsTable).values({
          gymId: req.gymId,
          trainerId: invoice.trainerId,
          sourcePaymentId: invoiceId,
          amount: invoice.trainerCommission,
          date: paidDate || DateUtils.getCurrentDate(),
          createdBy: req.user.userId,
        });
      }

      // Create audit log
      await createAuditLog({
        gymId: req.gymId,
        userId: req.user.userId,
        userName: req.user.email,
        action: "updated",
        entity: "invoice",
        entityId: invoiceId.toString(),
        changes: {
          before: { status: invoice.status },
          after: { status: "paid", paidDate: paidDate || DateUtils.getCurrentDate() },
        },
        metadata: getRequestMetadata(req),
      });

      return updated[0];
    });

    res.json(successResponse(result, "Invoice marked as paid"));
  })
);

/**
 * DELETE /api/invoices/:id
 * Soft delete an invoice
 */
router.delete(
  "/:id",
  protectedRoute,
  requirePermission("billing", "delete"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const invoiceId = parseInt(req.params.id);
    const invoiceQuery = createQueryBuilder(invoicesTable, req.gymId);

    // Get invoice
    const invoice = await invoiceQuery.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    // Don't allow deleting paid invoices
    if (invoice.status === "paid") {
      throw new ValidationError("Cannot delete paid invoice");
    }

    // Soft delete
    await invoiceQuery.softDeleteById(invoiceId, req.user.userId);

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "deleted",
      entity: "invoice",
      entityId: invoiceId.toString(),
      changes: { before: invoice },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(null, "Invoice deleted successfully"));
  })
);

/**
 * GET /api/invoices/stats/overview
 * Get invoice statistics
 */
router.get(
  "/stats/overview",
  protectedRoute,
  requirePermission("billing", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const today = DateUtils.getCurrentDate();
    const thisMonth = today.substring(0, 7); // YYYY-MM

    const [totalRevenue, monthlyRevenue, unpaidCount, overdueCount] = await Promise.all([
      // Total revenue (all time)
      db
        .select({ total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.gymId, req.gymId),
            eq(invoicesTable.status, "paid"),
            isNull(invoicesTable.deletedAt)
          )
        ),

      // Monthly revenue
      db
        .select({ total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.gymId, req.gymId),
            eq(invoicesTable.status, "paid"),
            sql`paid_date LIKE ${thisMonth + "%"}`,
            isNull(invoicesTable.deletedAt)
          )
        ),

      // Unpaid count
      db
        .select({ count: sql<number>`count(*)` })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.gymId, req.gymId),
            eq(invoicesTable.status, "unpaid"),
            isNull(invoicesTable.deletedAt)
          )
        ),

      // Overdue count
      db
        .select({ count: sql<number>`count(*)` })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.gymId, req.gymId),
            eq(invoicesTable.status, "unpaid"),
            sql`due_date < ${today}`,
            isNull(invoicesTable.deletedAt)
          )
        ),
    ]);

    res.json(
      successResponse({
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        unpaidCount: unpaidCount[0]?.count || 0,
        overdueCount: overdueCount[0]?.count || 0,
      })
    );
  })
);

export default router;
