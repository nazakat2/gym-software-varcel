import { pgTable, text, uuid, timestamp, numeric, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gymsTable = pgTable("gyms", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // for subdomain: acme-gym.yourdomain.com

  // Contact & Location
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  city: text("city"),

  // Branding
  logoUrl: text("logo_url"),

  // Business Settings
  currency: text("currency").notNull().default("PKR"),
  timezone: text("timezone").notNull().default("Asia/Karachi"),

  // Membership Fees (can be overridden per gym)
  dailyFee: numeric("daily_fee", { precision: 10, scale: 2 }).default("200"),
  weeklyFee: numeric("weekly_fee", { precision: 10, scale: 2 }).default("800"),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).default("3000"),
  quarterlyFee: numeric("quarterly_fee", { precision: 10, scale: 2 }).default("8000"),
  yearlyFee: numeric("yearly_fee", { precision: 10, scale: 2 }).default("28000"),

  // Subscription & Status
  subscriptionTier: text("subscription_tier").notNull().default("basic"), // basic, pro, enterprise
  subscriptionStatus: text("subscription_status").notNull().default("active"), // active, suspended, cancelled
  subscriptionExpiresAt: timestamp("subscription_expires_at"),

  // Stripe Integration
  stripeCustomerId: text("stripe_customer_id").unique(),

  isActive: boolean("is_active").default(true),

  // Audit
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  slugIdx: index("gyms_slug_idx").on(table.slug),
  isActiveIdx: index("gyms_is_active_idx").on(table.isActive),
}));

export const insertGymSchema = createInsertSchema(gymsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertGym = z.infer<typeof insertGymSchema>;
export type Gym = typeof gymsTable.$inferSelect;
