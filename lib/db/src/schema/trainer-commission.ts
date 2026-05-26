import { pgTable, text, serial, timestamp, integer, numeric, boolean, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { employeesTable } from "./employees";
import { invoicesTable } from "./billing";
import { gymsTable } from "./gyms";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Plan Details
  name: text("name").notNull(), // "Personal Training - Monthly"
  totalFee: numeric("total_fee", { precision: 10, scale: 2 }).notNull(),

  // Commission Structure
  commissionType: text("commission_type").notNull().default("percentage"), // percentage, fixed
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).notNull().default("0"),

  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("plans_gym_id_idx").on(table.gymId),
  gymActiveIdx: index("plans_gym_active_idx").on(table.gymId, table.isActive),
}));

export const clientSubscriptionsTable = pgTable("client_subscriptions", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  trainerId: integer("trainer_id").notNull().references(() => employeesTable.id, { onDelete: "restrict" }),
  planId: integer("plan_id").references(() => plansTable.id, { onDelete: "set null" }),

  // Subscription Period
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),

  purpose: text("purpose"), // weight_loss, muscle_gain, general_fitness
  status: text("status").notNull().default("active"), // active, completed, cancelled

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("client_subscriptions_gym_id_idx").on(table.gymId),
  memberIdIdx: index("client_subscriptions_member_id_idx").on(table.memberId),
  trainerIdIdx: index("client_subscriptions_trainer_id_idx").on(table.trainerId),
  gymStatusIdx: index("client_subscriptions_gym_status_idx").on(table.gymId, table.status),
}));

export const trainerEarningsTable = pgTable("trainer_earnings", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  trainerId: integer("trainer_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  sourcePaymentId: integer("source_payment_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => clientSubscriptionsTable.id, { onDelete: "set null" }),

  // Earnings
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: text("date").notNull(),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  gymIdIdx: index("trainer_earnings_gym_id_idx").on(table.gymId),
  trainerIdIdx: index("trainer_earnings_trainer_id_idx").on(table.trainerId),
  dateIdx: index("trainer_earnings_date_idx").on(table.date),
  gymTrainerDateIdx: index("trainer_earnings_gym_trainer_date_idx")
    .on(table.gymId, table.trainerId, table.date),
}));

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

export const insertClientSubscriptionSchema = createInsertSchema(clientSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertClientSubscription = z.infer<typeof insertClientSubscriptionSchema>;
export type ClientSubscription = typeof clientSubscriptionsTable.$inferSelect;

export const insertTrainerEarningSchema = createInsertSchema(trainerEarningsTable).omit({ id: true, createdAt: true });
export type InsertTrainerEarning = z.infer<typeof insertTrainerEarningSchema>;
export type TrainerEarning = typeof trainerEarningsTable.$inferSelect;
