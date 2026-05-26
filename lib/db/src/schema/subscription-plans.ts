import { pgTable, text, uuid, timestamp, numeric, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Subscription Plans Table
 * Defines available subscription tiers (Basic, Pro, Enterprise)
 */
export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Plan Details
  name: text("name").notNull(), // "Basic", "Pro", "Enterprise"
  slug: text("slug").notNull().unique(), // "basic", "pro", "enterprise"
  description: text("description"),

  // Pricing (in PKR)
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }).notNull(),

  // Stripe Product & Price IDs
  stripeProductId: text("stripe_product_id"),
  stripeMonthlyPriceId: text("stripe_monthly_price_id"),
  stripeYearlyPriceId: text("stripe_yearly_price_id"),

  // Features (JSON array of feature strings)
  features: text("features").array().notNull().default([]),

  // Limits
  maxMembers: numeric("max_members", { precision: 10, scale: 0 }), // null = unlimited
  maxStaff: numeric("max_staff", { precision: 10, scale: 0 }), // null = unlimited
  maxBranches: numeric("max_branches", { precision: 10, scale: 0 }).default("1"),

  // Status
  isActive: boolean("is_active").default(true),
  displayOrder: numeric("display_order", { precision: 3, scale: 0 }).default("0"),

  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  slugIdx: index("subscription_plans_slug_idx").on(table.slug),
  isActiveIdx: index("subscription_plans_is_active_idx").on(table.isActive),
}));

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
