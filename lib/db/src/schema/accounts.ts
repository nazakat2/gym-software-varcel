import { pgTable, text, serial, timestamp, integer, numeric, uuid, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gymsTable } from "./gyms";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Account Details
  name: text("name").notNull(), // "Cash", "Bank - HBL", "Petty Cash"
  type: text("type").notNull(), // asset, liability, equity, revenue, expense
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),

  isActive: boolean("is_active").default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("accounts_gym_id_idx").on(table.gymId),
  gymTypeIdx: index("accounts_gym_type_idx").on(table.gymId, table.type),
}));

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Human-readable voucher number (VCH-2024-001)
  voucherNumber: text("voucher_number").notNull(),

  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "restrict" }),

  // Voucher Details
  type: text("type").notNull(), // debit, credit
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  gymIdIdx: index("vouchers_gym_id_idx").on(table.gymId),
  accountIdIdx: index("vouchers_account_id_idx").on(table.accountId),
  dateIdx: index("vouchers_date_idx").on(table.date),
  gymDateIdx: index("vouchers_gym_date_idx").on(table.gymId, table.date),
}));

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true });
export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, createdAt: true });

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;
