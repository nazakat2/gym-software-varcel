import { pgTable, serial, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { gymsTable } from "./gyms";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),

  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  userId: uuid("user_id"), // who performed the action
  userName: text("user_name"), // cached for display

  action: text("action").notNull(), // "created", "updated", "deleted", "restored"
  entity: text("entity").notNull(), // "member", "invoice", "attendance", "admin_user"
  entityId: text("entity_id").notNull(), // ID of the affected record

  changes: jsonb("changes").$type<{
    before?: Record<string, any>;
    after?: Record<string, any>;
  }>(), // before/after values for updates

  metadata: jsonb("metadata").$type<{
    ipAddress?: string;
    userAgent?: string;
    route?: string;
    method?: string;
  }>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  gymIdIdx: index("audit_logs_gym_id_idx").on(table.gymId),
  entityIdx: index("audit_logs_entity_idx").on(table.entity, table.entityId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
}));

export type AuditLog = typeof auditLogsTable.$inferSelect;
