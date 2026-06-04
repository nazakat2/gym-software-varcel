import { Router } from "express";
import { z } from "zod/v4";
import { eq, and, desc, between, sql, isNull, like } from "drizzle-orm";
import { db } from "../../lib/db";
import { attendanceTable, membersTable } from "../../lib/db/src/schema";
import { protectedRoute, requirePermission, AuthenticatedRequest } from "../../lib/middleware/auth";
import { validate, asyncHandler, successResponse, NotFoundError, ValidationError } from "../../lib/middleware/error-handler";
import { createAuditLog, getRequestMetadata } from "../../lib/middleware/audit";
import { createQueryBuilder } from "../../utils/query-builder";
import { DateUtils } from "../../utils/helpers";

const router = Router();

/**
 * Validation Schemas
 */
const checkinSchema = z.object({
  memberId: z.number().int().positive("Invalid member ID"),
  checkInMethod: z.enum(["manual", "barcode", "qr", "biometric"]).default("manual"),
  notes: z.string().optional(),
});

const checkoutSchema = z.object({
  attendanceId: z.number().int().positive("Invalid attendance ID"),
  notes: z.string().optional(),
});

const searchAttendanceSchema = z.object({
  memberId: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const reportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  memberId: z.coerce.number().int().positive().optional(),
});

/**
 * POST /api/attendance/checkin
 * Check in a member
 */
router.post(
  "/checkin",
  protectedRoute,
  requirePermission("attendance", "create"),
  validate(checkinSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { memberId, checkInMethod, notes } = req.body;

    // Verify member exists and is active
    const member = await db.query.membersTable.findFirst({
      where: and(
        eq(membersTable.id, memberId),
        eq(membersTable.gymId, req.gymId),
        eq(membersTable.isActive, true),
        isNull(membersTable.deletedAt)
      ),
    });

    if (!member) {
      throw new NotFoundError("Member not found or inactive");
    }

    // Check if member's membership is expired
    const today = DateUtils.getCurrentDate();
    if (DateUtils.isExpired(member.planExpiryDate)) {
      throw new ValidationError(
        `Membership expired on ${DateUtils.formatDate(member.planExpiryDate)}`
      );
    }

    // Check if member is frozen
    if (member.frozenUntil && !DateUtils.isExpired(member.frozenUntil)) {
      throw new ValidationError(
        `Membership frozen until ${DateUtils.formatDate(member.frozenUntil)}`
      );
    }

    // Check if member is blacklisted
    if (member.blacklisted) {
      throw new ValidationError("Member is blacklisted");
    }

    // Check if already checked in today
    const existingCheckIn = await db.query.attendanceTable.findFirst({
      where: and(
        eq(attendanceTable.gymId, req.gymId),
        eq(attendanceTable.memberId, memberId),
        eq(attendanceTable.date, today),
        isNull(attendanceTable.checkOutTime),
        isNull(attendanceTable.deletedAt)
      ),
    });

    if (existingCheckIn) {
      throw new ValidationError("Member already checked in");
    }

    // Create attendance record
    const attendance = await db
      .insert(attendanceTable)
      .values({
        gymId: req.gymId,
        memberId,
        date: today,
        checkInTime: DateUtils.getCurrentTime(),
        checkInMethod,
        notes,
        createdBy: req.user.userId,
      })
      .returning();

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "created",
      entity: "attendance",
      entityId: attendance[0].id.toString(),
      changes: { after: attendance[0] },
      metadata: getRequestMetadata(req),
    });

    res.status(201).json(
      successResponse(
        {
          ...attendance[0],
          member: {
            id: member.id,
            name: member.name,
            memberCode: member.memberCode,
            phone: member.phone,
          },
        },
        "Member checked in successfully"
      )
    );
  })
);

/**
 * POST /api/attendance/checkout
 * Check out a member
 */
router.post(
  "/checkout",
  protectedRoute,
  requirePermission("attendance", "update"),
  validate(checkoutSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { attendanceId, notes } = req.body;

    // Get attendance record
    const attendance = await db.query.attendanceTable.findFirst({
      where: and(
        eq(attendanceTable.id, attendanceId),
        eq(attendanceTable.gymId, req.gymId),
        isNull(attendanceTable.deletedAt)
      ),
    });

    if (!attendance) {
      throw new NotFoundError("Attendance record not found");
    }

    if (attendance.checkOutTime) {
      throw new ValidationError("Member already checked out");
    }

    // Update attendance record
    const updated = await db
      .update(attendanceTable)
      .set({
        checkOutTime: DateUtils.getCurrentTime(),
        notes: notes || attendance.notes,
        updatedAt: new Date(),
      })
      .where(eq(attendanceTable.id, attendanceId))
      .returning();

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "updated",
      entity: "attendance",
      entityId: attendanceId.toString(),
      changes: {
        before: { checkOutTime: null },
        after: { checkOutTime: updated[0].checkOutTime },
      },
      metadata: getRequestMetadata(req),
    });

    res.json(
      successResponse(updated[0], "Member checked out successfully")
    );
  })
);

/**
 * GET /api/attendance
 * List attendance records with pagination
 */
router.get(
  "/",
  protectedRoute,
  requirePermission("attendance", "read"),
  validate(searchAttendanceSchema, "query"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { memberId, date, startDate, endDate, page, limit } = req.query as any;

    // Build where conditions
    let whereConditions = and(
      eq(attendanceTable.gymId, req.gymId),
      isNull(attendanceTable.deletedAt)
    );

    if (memberId) {
      whereConditions = and(whereConditions, eq(attendanceTable.memberId, memberId));
    }

    if (date) {
      whereConditions = and(whereConditions, eq(attendanceTable.date, date));
    } else if (startDate && endDate) {
      whereConditions = and(
        whereConditions,
        between(attendanceTable.date, startDate, endDate)
      );
    }

    // Get attendance with member details
    const result = await db
      .select({
        attendance: attendanceTable,
        member: {
          id: membersTable.id,
          name: membersTable.name,
          memberCode: membersTable.memberCode,
          phone: membersTable.phone,
          photoUrl: membersTable.photoUrl,
        },
      })
      .from(attendanceTable)
      .leftJoin(membersTable, eq(attendanceTable.memberId, membersTable.id))
      .where(whereConditions)
      .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkInTime))
      .limit(limit)
      .offset((page - 1) * limit);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceTable)
      .where(whereConditions);

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
 * GET /api/attendance/today
 * Get today's attendance (currently checked in members)
 */
router.get(
  "/today",
  protectedRoute,
  requirePermission("attendance", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const today = DateUtils.getCurrentDate();

    const result = await db
      .select({
        attendance: attendanceTable,
        member: {
          id: membersTable.id,
          name: membersTable.name,
          memberCode: membersTable.memberCode,
          phone: membersTable.phone,
          photoUrl: membersTable.photoUrl,
        },
      })
      .from(attendanceTable)
      .leftJoin(membersTable, eq(attendanceTable.memberId, membersTable.id))
      .where(
        and(
          eq(attendanceTable.gymId, req.gymId),
          eq(attendanceTable.date, today),
          isNull(attendanceTable.checkOutTime), // Still checked in
          isNull(attendanceTable.deletedAt)
        )
      )
      .orderBy(desc(attendanceTable.checkInTime));

    res.json(
      successResponse({
        date: today,
        count: result.length,
        members: result,
      })
    );
  })
);

/**
 * GET /api/attendance/report
 * Generate attendance report
 */
router.get(
  "/report",
  protectedRoute,
  requirePermission("attendance", "read"),
  validate(reportSchema, "query"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { startDate, endDate, memberId } = req.query as any;

    let whereConditions = and(
      eq(attendanceTable.gymId, req.gymId),
      between(attendanceTable.date, startDate, endDate),
      isNull(attendanceTable.deletedAt)
    );

    if (memberId) {
      whereConditions = and(whereConditions, eq(attendanceTable.memberId, memberId));
    }

    // Get attendance records
    const records = await db
      .select({
        attendance: attendanceTable,
        member: {
          id: membersTable.id,
          name: membersTable.name,
          memberCode: membersTable.memberCode,
        },
      })
      .from(attendanceTable)
      .leftJoin(membersTable, eq(attendanceTable.memberId, membersTable.id))
      .where(whereConditions)
      .orderBy(attendanceTable.date, attendanceTable.checkInTime);

    // Calculate statistics
    const totalDays = DateUtils.getDaysUntilExpiry(startDate) - DateUtils.getDaysUntilExpiry(endDate);
    const uniqueMembers = new Set(records.map((r) => r.attendance.memberId)).size;
    const totalCheckIns = records.length;
    const averagePerDay = totalCheckIns / Math.max(totalDays, 1);

    // Group by date
    const byDate: Record<string, number> = {};
    records.forEach((record) => {
      const date = record.attendance.date;
      byDate[date] = (byDate[date] || 0) + 1;
    });

    // Group by member (if specific member)
    let memberStats = null;
    if (memberId) {
      const memberRecords = records.filter((r) => r.attendance.memberId === memberId);
      memberStats = {
        totalCheckIns: memberRecords.length,
        dates: memberRecords.map((r) => r.attendance.date),
        averagePerWeek: (memberRecords.length / Math.max(totalDays / 7, 1)).toFixed(1),
      };
    }

    res.json(
      successResponse({
        period: {
          startDate,
          endDate,
          totalDays,
        },
        summary: {
          totalCheckIns,
          uniqueMembers,
          averagePerDay: averagePerDay.toFixed(1),
        },
        byDate,
        memberStats,
        records: records.slice(0, 100), // Limit to 100 records in response
      })
    );
  })
);

/**
 * GET /api/attendance/stats/overview
 * Get attendance statistics
 */
router.get(
  "/stats/overview",
  protectedRoute,
  requirePermission("attendance", "read"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const today = DateUtils.getCurrentDate();
    const thisMonth = today.substring(0, 7); // YYYY-MM

    const [todayCount, monthlyCount, currentlyCheckedIn] = await Promise.all([
      // Today's attendance
      db
        .select({ count: sql<number>`count(*)` })
        .from(attendanceTable)
        .where(
          and(
            eq(attendanceTable.gymId, req.gymId),
            eq(attendanceTable.date, today),
            isNull(attendanceTable.deletedAt)
          )
        ),

      // Monthly attendance
      db
        .select({ count: sql<number>`count(*)` })
        .from(attendanceTable)
        .where(
          and(
            eq(attendanceTable.gymId, req.gymId),
            sql`date LIKE ${thisMonth + "%"}`,
            isNull(attendanceTable.deletedAt)
          )
        ),

      // Currently checked in
      db
        .select({ count: sql<number>`count(*)` })
        .from(attendanceTable)
        .where(
          and(
            eq(attendanceTable.gymId, req.gymId),
            eq(attendanceTable.date, today),
            isNull(attendanceTable.checkOutTime),
            isNull(attendanceTable.deletedAt)
          )
        ),
    ]);

    res.json(
      successResponse({
        today: todayCount[0]?.count || 0,
        thisMonth: monthlyCount[0]?.count || 0,
        currentlyCheckedIn: currentlyCheckedIn[0]?.count || 0,
      })
    );
  })
);

/**
 * DELETE /api/attendance/:id
 * Soft delete an attendance record
 */
router.delete(
  "/:id",
  protectedRoute,
  requirePermission("attendance", "delete"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const attendanceId = parseInt(req.params.id);
    const attendanceQuery = createQueryBuilder(attendanceTable, req.gymId);

    // Get attendance
    const attendance = await attendanceQuery.findById(attendanceId);
    if (!attendance) {
      throw new NotFoundError("Attendance record not found");
    }

    // Soft delete
    await attendanceQuery.softDeleteById(attendanceId, req.user.userId);

    // Create audit log
    await createAuditLog({
      gymId: req.gymId,
      userId: req.user.userId,
      userName: req.user.email,
      action: "deleted",
      entity: "attendance",
      entityId: attendanceId.toString(),
      changes: { before: attendance },
      metadata: getRequestMetadata(req),
    });

    res.json(successResponse(null, "Attendance record deleted successfully"));
  })
);

export default router;
