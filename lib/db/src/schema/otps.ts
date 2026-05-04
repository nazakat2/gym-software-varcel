import { pgTable, text, serial, timestamp, bigint } from "drizzle-orm/pg-core";

export const otpsTable = pgTable("otps", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  type: text("type").notNull(), // "signup" | "reset"
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  data: text("data"), // JSON string for signup data
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Otp = typeof otpsTable.$inferSelect;
