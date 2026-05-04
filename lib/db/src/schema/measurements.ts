import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

export const measurementsTable = pgTable("measurements", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  weight: numeric("weight", { precision: 5, scale: 1 }).notNull(),
  height: numeric("height", { precision: 5, scale: 1 }).notNull(),
  bmi: numeric("bmi", { precision: 4, scale: 1 }).notNull(),
  bodyFat: numeric("body_fat", { precision: 4, scale: 1 }),
  chest: numeric("chest", { precision: 5, scale: 1 }),
  waist: numeric("waist", { precision: 5, scale: 1 }),
  arms: numeric("arms", { precision: 5, scale: 1 }),
  hips: numeric("hips", { precision: 5, scale: 1 }),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMeasurementSchema = createInsertSchema(measurementsTable).omit({ id: true, createdAt: true });
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurementsTable.$inferSelect;
