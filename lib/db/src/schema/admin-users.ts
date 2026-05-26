import { pgTable, text, serial, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gymsTable } from "./gyms";

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),

  // Multi-tenancy — null only for super_admin
  gymId: uuid("gym_id").references(() => gymsTable.id, { onDelete: "cascade" }),

  // User Information
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),

  // Role & Permissions
  role: text("role").notNull().default("receptionist"),
  permissions: text("permissions").array().default([]),

  // Status & Activity
  status: text("status").notNull().default("active"),
  lastLogin: text("last_login"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({ id: true, createdAt: true });
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsersTable.$inferSelect;
