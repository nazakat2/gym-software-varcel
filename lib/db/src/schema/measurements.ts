import { pgTable, text, serial, timestamp, integer, numeric, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { gymsTable } from "./gyms";

export const measurementsTable = pgTable("measurements", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),

  // Body Measurements
  weight: numeric("weight", { precision: 5, scale: 1 }).notNull(), // kg
  height: numeric("height", { precision: 5, scale: 1 }).notNull(), // cm
  bmi: numeric("bmi", { precision: 6, scale: 1 }).notNull(),
  bodyFat: numeric("body_fat", { precision: 4, scale: 1 }), // percentage

  // Body Parts (in cm)
  chest: numeric("chest", { precision: 5, scale: 1 }),
  waist: numeric("waist", { precision: 5, scale: 1 }),
  arms: numeric("arms", { precision: 5, scale: 1 }),
  hips: numeric("hips", { precision: 5, scale: 1 }),
  thighs: numeric("thighs", { precision: 5, scale: 1 }),
  calves: numeric("calves", { precision: 5, scale: 1 }),

  // Progress Photos
  beforePhoto: text("before_photo"),
  afterPhoto: text("after_photo"),

  // Metadata
  date: text("date").notNull(), // YYYY-MM-DD
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
  gymIdIdx: index("measurements_gym_id_idx").on(table.gymId),
  memberIdIdx: index("measurements_member_id_idx").on(table.memberId),
  dateIdx: index("measurements_date_idx").on(table.date),
  gymMemberDateIdx: index("measurements_gym_member_date_idx")
    .on(table.gymId, table.memberId, table.date),
}));

export const insertMeasurementSchema = createInsertSchema(measurementsTable).omit({ id: true, createdAt: true });
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurementsTable.$inferSelect;
