import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  membersTable,
  employeesTable,
  invoicesTable,
  attendanceTable,
  productsTable,
} from "@workspace/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";

// ── Helper: extract gymId from JWT Bearer token ───────────────────────────
function getGymIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.log(`[AUTH] No Bearer token on ${req.path}`);
      return null;
    }
    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.log(`[AUTH] JWT_SECRET not set`);
      return null;
    }
    const decoded = jwt.verify(token, jwtSecret) as any;
    console.log(`[AUTH] gymId=${decoded.gymId} on ${req.path}`);
    return decoded.gymId || null;
  } catch (e: any) {
    console.log(`[AUTH] JWT verify failed on ${req.path}: ${e.message}`);
    return null;
  }
}

// Error handling wrapper for async routes
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Dashboard Error in ${req.path}:`, errorMessage);
      res.status(500).json({
        message: "Dashboard operation failed",
        error: errorMessage,
      });
    }
  };

const router = Router();

/**
 * GET /api/dashboard/stats
 */
router.get(
  "/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const gymId = getGymIdFromRequest(req);
    if (!gymId) {
      return res.status(401).json({ message: "Unauthorized: no gym context" });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStr = now.toISOString().slice(0, 10);
    const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);

    const [membersAll, attending, invoicesAll, employees, products] = await Promise.all([
      db.select().from(membersTable).where(eq(membersTable.gymId, gymId)),
      db.select().from(attendanceTable).where(and(eq(attendanceTable.gymId, gymId), eq(attendanceTable.date, todayStr))),
      db.select().from(invoicesTable).where(eq(invoicesTable.gymId, gymId)),
      db.select().from(employeesTable).where(and(eq(employeesTable.gymId, gymId), eq(employeesTable.status, "active"))),
      db.select().from(productsTable).where(eq(productsTable.gymId, gymId)),
    ]);

    const activeMembers = membersAll.filter(m => m.status === "active").length;
    const monthlyRevenue = invoicesAll
      .filter(i => i.status === "paid" && i.paidDate && i.paidDate >= startOfMonthStr)
      .reduce((s, i) => s + parseFloat(i.amount as string), 0);
    const unpaidDues = invoicesAll
      .filter(i => i.status === "unpaid")
      .reduce((s, i) => s + parseFloat(i.amount as string), 0);
    const lowStockItems = products.filter(p => p.stock <= p.lowStockThreshold).length;

    res.json({
      totalMembers: membersAll.length,
      activeMembers,
      expiredMembers: membersAll.length - activeMembers,
      todayAttendance: attending.length,
      monthlyRevenue,
      unpaidDues,
      totalEmployees: employees.length,
      lowStockItems,
    });
  })
);

/**
 * GET /api/dashboard/revenue-chart
 */
router.get(
  "/revenue-chart",
  asyncHandler(async (req: Request, res: Response) => {
    const gymId = getGymIdFromRequest(req);
    if (!gymId) {
      return res.status(401).json({ message: "Unauthorized: no gym context" });
    }

    const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.gymId, gymId));

    const months: Record<string, { revenue: number; expenses: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months[key] = { revenue: 0, expenses: 0 };
    }

    for (const inv of invoices) {
      if (inv.status === "paid" && inv.paidDate) {
        const k = inv.paidDate.slice(0, 7);
        if (months[k]) months[k].revenue += parseFloat(inv.amount as string);
      }
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    res.json(Object.entries(months).map(([key, val]) => ({
      month: monthNames[parseInt(key.split("-")[1]) - 1],
      revenue: Math.round(val.revenue),
      expenses: Math.round(val.expenses),
    })));
  })
);

/**
 * GET /api/dashboard/membership-breakdown
 */
router.get(
  "/membership-breakdown",
  asyncHandler(async (req: Request, res: Response) => {
    const gymId = getGymIdFromRequest(req);
    if (!gymId) {
      return res.status(401).json({ message: "Unauthorized: no gym context" });
    }

    const members = await db.select().from(membersTable).where(eq(membersTable.gymId, gymId));
    const counts: Record<string, number> = { monthly: 0, quarterly: 0, yearly: 0 };
    for (const m of members) {
      if (counts[m.plan] !== undefined) counts[m.plan]++;
    }

    res.json([
      { name: "Monthly", value: counts.monthly, color: "#E31C25" },
      { name: "Quarterly", value: counts.quarterly, color: "#FF6B35" },
      { name: "Yearly", value: counts.yearly, color: "#22C55E" },
    ]);
  })
);

/**
 * GET /api/dashboard/recent-activity
 */
router.get(
  "/recent-activity",
  asyncHandler(async (req: Request, res: Response) => {
    const gymId = getGymIdFromRequest(req);
    if (!gymId) {
      return res.status(401).json({ message: "Unauthorized: no gym context" });
    }

    const [members, invoices, attendance] = await Promise.all([
      db.select().from(membersTable).where(eq(membersTable.gymId, gymId)).orderBy(desc(membersTable.createdAt)).limit(5),
      db.select().from(invoicesTable).where(eq(invoicesTable.gymId, gymId)).orderBy(desc(invoicesTable.createdAt)).limit(5),
      db.select().from(attendanceTable).where(eq(attendanceTable.gymId, gymId)).orderBy(desc(attendanceTable.createdAt)).limit(5),
    ]);

    const activities = [
      ...members.map(m => ({ id: m.id * 100, type: "member", description: `New member: ${m.name}`, time: m.createdAt.toISOString(), icon: "user" })),
      ...invoices.map(i => ({ id: i.id * 100 + 1, type: "invoice", description: `Invoice ${i.status === "paid" ? "paid" : "created"} — PKR ${i.amount}`, time: i.createdAt.toISOString(), icon: "receipt" })),
      ...attendance.map(a => ({ id: a.id * 100 + 2, type: "attendance", description: `Member checked in`, time: a.createdAt.toISOString(), icon: "check" })),
    ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 10);

    res.json(activities);
  })
);

export default router;
