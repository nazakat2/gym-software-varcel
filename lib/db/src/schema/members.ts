import { pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { gymsTable } from "./gyms";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Human-readable member code (MEM-001, MEM-002)
  memberCode: text("member_code").notNull(),

  // Personal Information
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

  // Emergency Contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),

  // Fitness & Referral
  fitnessGoal: text("fitness_goal").default("general"),
  referralSource: text("referral_source"),

  // Photo
  photoUrl: text("photo_url"),

  // Membership
  plan: text("plan").notNull().default("monthly"),
  planStartDate: text("plan_start_date").notNull(),
  planExpiryDate: text("plan_expiry_date").notNull(),
  frozenUntil: text("frozen_until"),

  // Trainer Assignment
  assignedTrainerId: integer("assigned_trainer_id"),

  // Status
  status: text("status").notNull().default("active"), // active, expired, frozen
  blacklisted: boolean("blacklisted").default(false),
  isActive: boolean("is_active").default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  // Composite indexes for multi-tenant queries
  gymActiveIdx: index("members_gym_active_idx")
    .on(table.gymId, table.isActive),
  gymStatusIdx: index("members_gym_status_idx")
    .on(table.gymId, table.status),

  // Partial unique indexes (only for non-deleted records)
  gymPhoneUnique: uniqueIndex("members_gym_phone_unique")
    .on(table.gymId, table.phone)
    .where(sql`deleted_at IS NULL`),

  gymCnicUnique: uniqueIndex("members_gym_cnic_unique")
    .on(table.gymId, table.cnic)
    .where(sql`deleted_at IS NULL`),

  gymMemberCodeUnique: uniqueIndex("members_gym_code_unique")
    .on(table.gymId, table.memberCode)
    .where(sql`deleted_at IS NULL`),
}));

export const memberHealthTable = pgTable("member_health", {
  id: serial("id").primaryKey(),

  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),

  conditions: jsonb("conditions").$type<string[]>().default(sql`'[]'::jsonb`),
  allergies: text("allergies"),
  medicalHistory: text("medical_history"),
  doctorRecommendations: text("doctor_recommendations"),
  currentMedications: text("current_medications"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  gymIdIdx: index("member_health_gym_id_idx").on(table.gymId),
  memberIdIdx: index("member_health_member_id_idx").on(table.memberId),
}));

export const memberNotesTable = pgTable("member_notes", {
  id: serial("id").primaryKey(),

  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),

  note: text("note").notNull(),
  type: text("type").notNull().default("admin"), // admin, trainer, system

  createdBy: uuid("created_by"), // admin user ID
  createdByName: text("created_by_name"), // cached for display

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("member_notes_gym_id_idx").on(table.gymId),
  memberIdIdx: index("member_notes_member_id_idx").on(table.memberId),
  createdAtIdx: index("member_notes_created_at_idx").on(table.createdAt),
}));

export const membershipHistoryTable = pgTable("membership_history", {
  id: serial("id").primaryKey(),

  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),

  plan: text("plan").notNull(),
  startDate: text("start_date").notNull(),
  expiryDate: text("expiry_date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("completed"), // completed, cancelled, refunded
  notes: text("notes"),

  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  gymIdIdx: index("membership_history_gym_id_idx").on(table.gymId),
  memberIdIdx: index("membership_history_member_id_idx").on(table.memberId),
  createdAtIdx: index("membership_history_created_at_idx").on(table.createdAt),
}));

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
