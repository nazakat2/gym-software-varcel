import { pgTable, text, serial, timestamp, integer, numeric, uuid, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { gymsTable } from "./gyms";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Human-readable invoice number (INV-2024-001)
  invoiceNumber: text("invoice_number").notNull(),

  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),

  // Invoice Details
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  plan: text("plan").notNull(), // daily, weekly, monthly, quarterly, yearly
  dueDate: text("due_date").notNull(),
  paidDate: text("paid_date"),

  // Payment
  status: text("status").notNull().default("unpaid"), // unpaid, paid, overdue, cancelled
  paymentMethod: text("payment_method"), // cash, card, bank_transfer, upi

  // Trainer Commission (if applicable)
  trainerId: integer("trainer_id"),
  trainerCommission: numeric("trainer_commission", { precision: 10, scale: 2 }),
  gymRevenue: numeric("gym_revenue", { precision: 10, scale: 2 }),

  // Subscription tracking
  subscriptionId: integer("subscription_id"),

  // Notes
  notes: text("notes"),

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
  gymIdIdx: index("invoices_gym_id_idx").on(table.gymId),
  memberIdIdx: index("invoices_member_id_idx").on(table.memberId),
  statusIdx: index("invoices_status_idx").on(table.status),
  gymStatusIdx: index("invoices_gym_status_idx").on(table.gymId, table.status),
  dueDateIdx: index("invoices_due_date_idx").on(table.dueDate),
  createdAtIdx: index("invoices_created_at_idx").on(table.createdAt),
}));

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
