import { pgTable, text, serial, timestamp, boolean, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gymsTable } from "./gyms";

export const adminNotificationsTable = pgTable("admin_notifications", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Target user (null = all admins in gym)
  userId: uuid("user_id"),

  // Notification Details
  type: text("type").notNull(), // info, warning, error, success
  title: text("title").notNull(),
  message: text("message").notNull(),

  // Status
  read: boolean("read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),

  // Metadata
  actionUrl: text("action_url"), // optional link to related resource

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  gymIdIdx: index("admin_notifications_gym_id_idx").on(table.gymId),
  userIdIdx: index("admin_notifications_user_id_idx").on(table.userId),
  gymUserReadIdx: index("admin_notifications_gym_user_read_idx")
    .on(table.gymId, table.userId, table.read),
  createdAtIdx: index("admin_notifications_created_at_idx").on(table.createdAt),
}));

export const insertAdminNotificationSchema = createInsertSchema(adminNotificationsTable).omit({ id: true, createdAt: true });
export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;
export type AdminNotification = typeof adminNotificationsTable.$inferSelect;
