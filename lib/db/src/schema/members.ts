import { pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  whatsapp: text("whatsapp"),
  email: text("email"),
  gender: text("gender").default("male"),
  dob: text("dob"),
  cnic: text("cnic").notNull(),
  city: text("city"),
  area: text("area"),
  address: text("address"),
  bloodGroup: text("blood_group"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  fitnessGoal: text("fitness_goal").default("general"),
  referralSource: text("referral_source"),
  photoUrl: text("photo_url"),
  plan: text("plan").notNull().default("monthly"),
  planStartDate: text("plan_start_date").notNull(),
  planExpiryDate: text("plan_expiry_date").notNull(),
  frozenUntil: text("frozen_until"),
  assignedTrainerId: integer("assigned_trainer_id"),
  status: text("status").notNull().default("active"),
  blacklisted: boolean("blacklisted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberHealthTable = pgTable("member_health", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  conditions: jsonb("conditions").$type<string[]>().default([]),
  allergies: text("allergies"),
  medicalHistory: text("medical_history"),
  doctorRecommendations: text("doctor_recommendations"),
  currentMedications: text("current_medications"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberNotesTable = pgTable("member_notes", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  type: text("type").notNull().default("admin"),
  createdBy: text("created_by").notNull().default("Admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const membershipHistoryTable = pgTable("membership_history", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  startDate: text("start_date").notNull(),
  expiryDate: text("expiry_date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
