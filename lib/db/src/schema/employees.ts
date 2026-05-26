import { pgTable, text, serial, timestamp, integer, numeric, uuid, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { gymsTable } from "./gyms";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Personal Information
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"), // trainer, receptionist, cleaner, maintenance
  phone: text("phone").notNull(),
  cnic: text("cnic"),
  email: text("email"),
  address: text("home_address"),

  // Employment
  joinDate: text("join_date").notNull(),
  salary: numeric("salary", { precision: 10, scale: 2 }).notNull(),

  // Trainer-specific (for trainers only)
  commissionPercentage: numeric("commission_percentage", { precision: 5, scale: 2 }).default("0"), // 0-100%
  totalEarnings: numeric("total_earnings", { precision: 12, scale: 2 }).default("0"),
  assignedMembers: integer("assigned_members").default(0),

  // Status
  status: text("status").notNull().default("active"), // active, on_leave, terminated
  isActive: boolean("is_active").default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("employees_gym_id_idx").on(table.gymId),
  gymRoleIdx: index("employees_gym_role_idx").on(table.gymId, table.role),
  gymStatusIdx: index("employees_gym_status_idx").on(table.gymId, table.status),

  // Partial unique constraint for phone (only non-deleted)
  gymPhoneUnique: uniqueIndex("employees_gym_phone_unique")
    .on(table.gymId, table.phone)
    .where(sql`deleted_at IS NULL`),
}));

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
