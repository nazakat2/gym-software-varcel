import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { employeesTable } from "./employees";
import { invoicesTable } from "./billing";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  totalFee: numeric("total_fee", { precision: 10, scale: 2 }).notNull(),
  commissionType: text("commission_type").notNull().default("percentage"),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientSubscriptionsTable = pgTable("client_subscriptions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  trainerId: integer("trainer_id").notNull().references(() => employeesTable.id, { onDelete: "restrict" }),
  planId: integer("plan_id").references(() => plansTable.id, { onDelete: "set null" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  purpose: text("purpose"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trainerEarningsTable = pgTable("trainer_earnings", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainer_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  sourcePaymentId: integer("source_payment_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => clientSubscriptionsTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

export const insertClientSubscriptionSchema = createInsertSchema(clientSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertClientSubscription = z.infer<typeof insertClientSubscriptionSchema>;
export type ClientSubscription = typeof clientSubscriptionsTable.$inferSelect;

export const insertTrainerEarningSchema = createInsertSchema(trainerEarningsTable).omit({ id: true, createdAt: true });
export type InsertTrainerEarning = z.infer<typeof insertTrainerEarningSchema>;
export type TrainerEarning = typeof trainerEarningsTable.$inferSelect;
