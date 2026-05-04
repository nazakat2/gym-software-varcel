import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
  phone: text("phone").notNull(),
  cnic: text("cnic"),
  email: text("email"),
  salary: numeric("salary", { precision: 10, scale: 2 }).notNull(),
  commission: numeric("commission", { precision: 10, scale: 2 }).default("0"),
  assignedMembers: integer("assigned_members").default(0),
  joinDate: text("join_date").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
