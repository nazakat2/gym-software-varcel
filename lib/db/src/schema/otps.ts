import { pgTable, text, serial, timestamp, bigint, uuid, index } from "drizzle-orm/pg-core";
import { gymsTable } from "./gyms";

export const otpsTable = pgTable("otps", {
  id: serial("id").primaryKey(),

  // Multi-tenancy (nullable for system-wide OTPs like gym registration)
  gymId: uuid("gym_id")
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // OTP Details
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  type: text("type").notNull(), // "signup", "reset", "verify", "gym_registration"

  // Expiration
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),

  // Additional data (JSON string for signup data, etc.)
  data: text("data"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  gymIdIdx: index("otps_gym_id_idx").on(table.gymId),
  emailIdx: index("otps_email_idx").on(table.email),
  expiresAtIdx: index("otps_expires_at_idx").on(table.expiresAt),
}));

export type Otp = typeof otpsTable.$inferSelect;
