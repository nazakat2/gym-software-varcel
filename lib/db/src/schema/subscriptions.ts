import { pgTable, text, uuid, timestamp, numeric, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gymsTable } from "./gyms";
import { subscriptionPlansTable } from "./subscription-plans";

/**
 * Subscriptions Table
 * Tracks each gym's subscription with Stripe
 */
export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Relationships
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => subscriptionPlansTable.id),

  // Stripe IDs
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),

  // Subscription Details
  status: text("status").notNull().default("trial"), // trial, active, past_due, canceled, incomplete
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, yearly

  // Pricing
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PKR"),

  // Dates
  trialStartDate: timestamp("trial_start_date"),
  trialEndDate: timestamp("trial_end_date"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),

  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  gymIdIdx: index("subscriptions_gym_id_idx").on(table.gymId),
  statusIdx: index("subscriptions_status_idx").on(table.status),
  stripeSubscriptionIdIdx: index("subscriptions_stripe_subscription_id_idx").on(table.stripeSubscriptionId),
}));

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
