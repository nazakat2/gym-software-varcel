import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessSettingsTable = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  gymName: text("gym_name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  logoUrl: text("logo_url"),
  currency: text("currency").notNull().default("PKR"),
  timezone: text("timezone").notNull().default("Asia/Karachi"),
  dailyFee: numeric("daily_fee", { precision: 10, scale: 2 }).default("200"),
  weeklyFee: numeric("weekly_fee", { precision: 10, scale: 2 }).default("800"),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).default("3000"),
  quarterlyFee: numeric("quarterly_fee", { precision: 10, scale: 2 }).default("8000"),
  yearlyFee: numeric("yearly_fee", { precision: 10, scale: 2 }).default("28000"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBusinessSettingsSchema = createInsertSchema(businessSettingsTable).omit({ id: true, updatedAt: true });
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type BusinessSettings = typeof businessSettingsTable.$inferSelect;
