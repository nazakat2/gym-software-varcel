import { pgTable, text, uuid, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { gymsTable } from "./gyms";

/**
 * Branches Table (Optional - Phase 2)
 *
 * For gyms with multiple physical locations.
 * When implemented, add branchId to relevant tables (members, attendance, etc.)
 */
export const branchesTable = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Branch Details
  name: text("name").notNull(), // "Karachi Branch", "Lahore Branch"
  code: text("code").notNull(), // "KHI", "LHR" (used in member codes: KHI-MEM-001)

  // Contact & Location
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),

  // Manager
  managerId: uuid("manager_id"), // references admin_users.id

  isActive: boolean("is_active").default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  gymIdIdx: index("branches_gym_id_idx").on(table.gymId),
  gymActiveIdx: index("branches_gym_active_idx").on(table.gymId, table.isActive),

  // Unique branch code per gym
  gymCodeUnique: uniqueIndex("branches_gym_code_unique")
    .on(table.gymId, table.code)
    .where(sql`deleted_at IS NULL`),
}));

export const insertBranchSchema = createInsertSchema(branchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branchesTable.$inferSelect;
