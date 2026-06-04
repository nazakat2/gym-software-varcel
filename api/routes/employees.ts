import { Router } from "express";
import { z } from "zod/v4";
import { eq, and, desc, like, sql, isNull } from "drizzle-orm";
import { db } from "../../lib/db";
import { employeesTable } from "../../lib/db/src/schema";
import { protectedRoute, requirePermission, AuthenticatedRequest } from "../../lib/middleware/auth";
import { validate, asyncHandler, successResponse, NotFoundError, ValidationError } from "../../lib/middleware/error-handler";
import { createAuditLog, getRequestMetadata } from "../../lib/middleware/audit";
import { createQueryBuilder } from "../../utils/query-builder";
import { ValidationUtils, DateUtils } from "../../lib/utils/helpers";

const router = Router();

/**
 * Validation Schemas
 */
const createEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["trainer", "receptionist", "cleaner", "maintenance", "staff"]),
  phone: z.string().refine(ValidationUtils.isValidPhone, "Invalid phone number"),
  cnic: z.string().refine(ValidationUtils.isValidCNIC, "Invalid CNIC format").optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  salary: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid salary format"),
  commissionPercentage: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid commission format").optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

const searchEmployeesSchema = z.object({
  query: z.string().optional(),
  role: z.enum(["trainer", "receptionist", "cleaner", "maintenance", "staff"]).optional(),
  status: z.enum(["active", "on_leave", "terminated"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/employees
 * List all employees with pagination and filters
 */
router.get(
  "/",
  protectedRoute,
  requirePermission("members", "read"), // Using members permission for now
  validate(searchEmployeesSchema, "query"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { query, role, status, page, limit } = req.query as any;
    const employeeQuery = createQueryBuilder(employeesTable, req.gymId);

    // Build where conditions
    let whereConditions = undefined;

    if (query) {
      whereConditions = like(employeesTable.name, `%${query}%`);
    }

    if (role) {
      whereConditions = and(whereConditions, eq(employeesTable.role, role));
    }

    if (status) {
      whereConditions = and(whereConditions, eq(employeesTable.status, status));
    }

    // Paginated query
    const result = await employeeQuery.paginate({
      page,
      limit,
      where: whereConditions,
      orderBy: desc(employeesTable.createdAt),
    });

    res.json(successResponse(result));
  })
);

/**
 * GET /api/employees/:id
 * Get employee details by ID
 */
router.get(
  "/:id",
  protectedRoute,
  requirePermission("members", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const employeeId = parseInt(req.params.id);
    const employeeQuery = createQueryBuilder(employeesTable, req.gymId);

    const employee = await employeeQuery.findById(employeeId);

    if (!employee) {
      throw new NotFoundError("Employee not found");
    }

    // Get additional stats for trainers
    let stats = null;
    if (employee.role === "trainer") {
      // Get assigned members count
      const membersCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(db.query.membersTable)
        .where(
          and(
            eq(db.query.membersTable.gymId, req.gymId),
            eq(db.query.membersTable.assignedTrainerId, employeeId),
            eq(db.query.membersTable.isActive, true),
            isNull(db.query.membersTable.deletedAt)
          )
        );

      // Get total earnings this month
      const thisMonth = DateUtils.getCurrentDate().substring(0, 7);
      const earnings = await db
        .select({ total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` })
        .from(db.query.trainerEarningsTable)
        .where(
          and(
            eq(db.query.trainerEarningsTable.gymId, req.gymId),
            eq(db.query.trainerEarningsTable.trainerId, employeeId),
            sql`date LIKE ${thisMonth + "%"}`
          )
        );

      stats = {
        assignedMembers: membersCount[0]?.count || 0,
        monthlyEarnings: earnings[0]?.total || 0,
      };
    }

    res.json(
      successResponse({
        ...employee,
        stats,
      })
    );
  })
);

/**
 * POST /api/employees
 * Create a new employee
 */
router.post(
  "/",
  protectedRoute,
  requirePermission("members", "create"),
  validate(createEmployeeSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = req.body;

    // Check if phone already exists
    const existingEmployee = await db.query.employeesTable.findFirst({
      where: and(
        eq(employeesTable.gymId, req.gymId),
        eq(employeesTable.phone, data.phone),
        isNull(employeesTable.deletedAt)
      ),
    });

    if (existingEmployee) {
      throw new ValidationError("Phone number already registered");
    }

    // Create employee
    const employee = await db
      .insert(employeesTable)
      .values({
        gymId: req.gymId,
        ...data,
        status: "active",
        isActive: true,
        totalEarnings: "0",
        assignedMembers: 0,
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
      entity: "employee",
      entityId: employee[0].id.toString(),
      changes: { after: employee[0] },
      metadata: getRequestMetadata(req),
    });

    res.status(201).json(
      successResponse(employee[0], "Employee created successfully")
    );
  })
);

/**
 * PATCH /api/employees/:id
 * Update employee details
 */
router.patch(
  "/:id",
  protectedRoute,
  requirePermission("members", "update"),
  validate(updateEmployeeSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const employeeId = parseInt(req.params.id);
    const updates = req.body;
    const employeeQuery = createQueryBuilder(employeesTable, req.gymId);

    // Get current state
    const before = await employeeQuery.findById(employeeId);
    if (!before) {
      throw new NotFoundError("Employee not found");
    }

    // Check if phone is being changed and already exists
    if (updates.phone && updates.phone !== before.phone) {
      const existingEmployee = await db.query.employeesTable.findFirst({
        where: and(
          eq(employeesTable.gymId, req.gymId),
          eq(employeesTable.phone, updates.phone),
          isNull(employeesTable.deletedAt)
        ),
      });

      if (existingEmployee) {
        throw new ValidationError("Phone number already registered");
      }
    }

    // Update employee
    const after = await employeeQuery.updateById(
      employeeId,
      updates,
      req.user.userId
    );

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "updated",
      entity: "employee",
      entityId: employeeId.toString(),
      changes: { before, after },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(after, "Employee updated successfully"));
  })
);

/**
 * DELETE /api/employees/:id
 * Soft delete an employee
 */
router.delete(
  "/:id",
  protectedRoute,
  requirePermission("members", "delete"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const employeeId = parseInt(req.params.id);
    const employeeQuery = createQueryBuilder(employeesTable, req.gymId);

    // Get employee
    const employee = await employeeQuery.findById(employeeId);
    if (!employee) {
      throw new NotFoundError("Employee not found");
    }

    // Check if employee has assigned members
    if (employee.role === "trainer" && employee.assignedMembers > 0) {
      throw new ValidationError(
        "Cannot delete trainer with assigned members. Please reassign members first."
      );
    }

    // Soft delete
    await employeeQuery.softDeleteById(employeeId, req.user.userId);

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "deleted",
      entity: "employee",
      entityId: employeeId.toString(),
      changes: { before: employee },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(null, "Employee deleted successfully"));
  })
);

/**
 * GET /api/employees/trainers/list
 * Get list of trainers (for dropdowns)
 */
router.get(
  "/trainers/list",
  protectedRoute,
  requirePermission("members", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const trainers = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        phone: employeesTable.phone,
        assignedMembers: employeesTable.assignedMembers,
        commissionPercentage: employeesTable.commissionPercentage,
      })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.gymId, req.gymId),
          eq(employeesTable.role, "trainer"),
          eq(employeesTable.isActive, true),
          isNull(employeesTable.deletedAt)
        )
      )
      .orderBy(employeesTable.name);

    res.json(successResponse(trainers));
  })
);

/**
 * GET /api/employees/:id/earnings
 * Get trainer earnings history
 */
router.get(
  "/:id/earnings",
  protectedRoute,
  requirePermission("members", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const employeeId = parseInt(req.params.id);

    // Verify employee exists and is a trainer
    const employee = await db.query.employeesTable.findFirst({
      where: and(
        eq(employeesTable.id, employeeId),
        eq(employeesTable.gymId, req.gymId),
        eq(employeesTable.role, "trainer"),
        isNull(employeesTable.deletedAt)
      ),
    });

    if (!employee) {
      throw new NotFoundError("Trainer not found");
    }

    // Get earnings history
    const earnings = await db
      .select({
        earning: db.query.trainerEarningsTable,
        invoice: {
          id: db.query.invoicesTable.id,
          invoiceNumber: db.query.invoicesTable.invoiceNumber,
          amount: db.query.invoicesTable.amount,
        },
        member: {
          id: db.query.membersTable.id,
          name: db.query.membersTable.name,
          memberCode: db.query.membersTable.memberCode,
        },
      })
      .from(db.query.trainerEarningsTable)
      .leftJoin(
        db.query.invoicesTable,
        eq(db.query.trainerEarningsTable.sourcePaymentId, db.query.invoicesTable.id)
      )
      .leftJoin(
        db.query.membersTable,
        eq(db.query.invoicesTable.memberId, db.query.membersTable.id)
      )
      .where(
        and(
          eq(db.query.trainerEarningsTable.gymId, req.gymId),
          eq(db.query.trainerEarningsTable.trainerId, employeeId)
        )
      )
      .orderBy(desc(db.query.trainerEarningsTable.date))
      .limit(100);

    // Calculate total
    const total = await db
      .select({ sum: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` })
      .from(db.query.trainerEarningsTable)
      .where(
        and(
          eq(db.query.trainerEarningsTable.gymId, req.gymId),
          eq(db.query.trainerEarningsTable.trainerId, employeeId)
        )
      );

    res.json(
      successResponse({
        trainer: {
          id: employee.id,
          name: employee.name,
          commissionPercentage: employee.commissionPercentage,
        },
        totalEarnings: total[0]?.sum || 0,
        earnings,
      })
    );
  })
);

/**
 * GET /api/employees/stats/overview
 * Get employee statistics
 */
router.get(
  "/stats/overview",
  protectedRoute,
  requirePermission("members", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const [total, trainers, active, onLeave] = await Promise.all([
      // Total employees
      db
        .select({ count: sql<number>`count(*)` })
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.gymId, req.gymId),
            isNull(employeesTable.deletedAt)
          )
        ),

      // Trainers count
      db
        .select({ count: sql<number>`count(*)` })
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.gymId, req.gymId),
            eq(employeesTable.role, "trainer"),
            isNull(employeesTable.deletedAt)
          )
        ),

      // Active employees
      db
        .select({ count: sql<number>`count(*)` })
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.gymId, req.gymId),
            eq(employeesTable.status, "active"),
            isNull(employeesTable.deletedAt)
          )
        ),

      // On leave
      db
        .select({ count: sql<number>`count(*)` })
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.gymId, req.gymId),
            eq(employeesTable.status, "on_leave"),
            isNull(employeesTable.deletedAt)
          )
        ),
    ]);

    res.json(
      successResponse({
        total: total[0]?.count || 0,
        trainers: trainers[0]?.count || 0,
        active: active[0]?.count || 0,
        onLeave: onLeave[0]?.count || 0,
      })
    );
  })
);

export default router;
