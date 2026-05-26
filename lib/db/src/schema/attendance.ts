import { pgTable, text, serial, timestamp, integer, uuid, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { gymsTable } from "./gyms";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),

  // Attendance Data
  date: text("date").notNull(), // YYYY-MM-DD format
  checkInTime: text("check_in_time").notNull(), // HH:MM:SS format
  checkOutTime: text("check_out_time"), // HH:MM:SS format

  // Metadata
  checkInMethod: text("check_in_method").default("manual"), // manual, barcode, qr, biometric
  notes: text("notes"),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("attendance_gym_id_idx").on(table.gymId),
  memberIdIdx: index("attendance_member_id_idx").on(table.memberId),
  dateIdx: index("attendance_date_idx").on(table.date),
  gymDateIdx: index("attendance_gym_date_idx").on(table.gymId, table.date),
}));

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
