import { pgTable, text, serial, timestamp, integer, boolean, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { gymsTable } from "./gyms";

export const appAnnouncementsTable = pgTable("app_announcements", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Announcement Details
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("info"), // info, warning, success, promotion

  isActive: boolean("is_active").notNull().default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  gymIdIdx: index("app_announcements_gym_id_idx").on(table.gymId),
  gymActiveIdx: index("app_announcements_gym_active_idx").on(table.gymId, table.isActive),
}));

export const appClassesTable = pgTable("app_classes", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Class Details
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"), // yoga, cardio, strength, dance
  instructor: text("instructor").notNull(),

  // Schedule
  time: text("time").notNull(), // HH:MM format
  date: text("date").notNull(), // YYYY-MM-DD format
  duration: integer("duration").notNull().default(60), // minutes

  // Capacity
  capacity: integer("capacity").notNull().default(20),
  enrolled: integer("enrolled").notNull().default(0),

  // Location & Level
  location: text("location").notNull().default("Main Floor"),
  level: text("level").notNull().default("All levels"), // beginner, intermediate, advanced, all levels

  isActive: boolean("is_active").notNull().default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  gymIdIdx: index("app_classes_gym_id_idx").on(table.gymId),
  gymDateIdx: index("app_classes_gym_date_idx").on(table.gymId, table.date),
  gymActiveIdx: index("app_classes_gym_active_idx").on(table.gymId, table.isActive),
}));

export const appClassBookingsTable = pgTable("app_class_bookings", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  classId: integer("class_id").notNull().references(() => appClassesTable.id, { onDelete: "cascade" }),
  memberEmail: text("member_email").notNull(),

  status: text("status").notNull().default("confirmed"), // confirmed, cancelled, attended

  bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
}, (table) => ({
  gymIdIdx: index("app_class_bookings_gym_id_idx").on(table.gymId),
  classIdIdx: index("app_class_bookings_class_id_idx").on(table.classId),
  memberEmailIdx: index("app_class_bookings_member_email_idx").on(table.memberEmail),
}));

export const appWorkoutPlansTable = pgTable("app_workout_plans", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Plan Details
  name: text("name").notNull(),
  goal: text("goal").notNull().default("General fitness"), // weight_loss, muscle_gain, endurance, general_fitness
  level: text("level").notNull().default("Beginner"), // beginner, intermediate, advanced
  duration: text("duration").notNull().default("4 weeks"),
  daysPerWeek: integer("days_per_week").notNull().default(3),
  trainer: text("trainer").notNull().default(""),

  isActive: boolean("is_active").notNull().default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  gymIdIdx: index("app_workout_plans_gym_id_idx").on(table.gymId),
  gymActiveIdx: index("app_workout_plans_gym_active_idx").on(table.gymId, table.isActive),
}));

export const appWorkoutExercisesTable = pgTable("app_workout_exercises", {
  id: serial("id").primaryKey(),

  planId: integer("plan_id").notNull().references(() => appWorkoutPlansTable.id, { onDelete: "cascade" }),

  // Exercise Details
  name: text("name").notNull(),
  sets: integer("sets").notNull().default(3),
  reps: text("reps").notNull().default("10"), // can be "10" or "10-12" or "30 seconds"
  rest: text("rest").notNull().default("60s"),
  order: integer("order").notNull().default(0),
}, (table) => ({
  planIdIdx: index("app_workout_exercises_plan_id_idx").on(table.planId),
  planOrderIdx: index("app_workout_exercises_plan_order_idx").on(table.planId, table.order),
}));

export const appDietPlansTable = pgTable("app_diet_plans", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Plan Details
  name: text("name").notNull(),
  goal: text("goal").notNull().default("General health"), // weight_loss, muscle_gain, maintenance, general_health
  calories: integer("calories").notNull().default(2000),
  protein: integer("protein").notNull().default(100), // grams
  carbs: integer("carbs").notNull().default(250), // grams
  fat: integer("fat").notNull().default(70), // grams
  dietitian: text("dietitian").notNull().default(""),

  isActive: boolean("is_active").notNull().default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  gymIdIdx: index("app_diet_plans_gym_id_idx").on(table.gymId),
  gymActiveIdx: index("app_diet_plans_gym_active_idx").on(table.gymId, table.isActive),
}));

export const appDietMealsTable = pgTable("app_diet_meals", {
  id: serial("id").primaryKey(),

  planId: integer("plan_id").notNull().references(() => appDietPlansTable.id, { onDelete: "cascade" }),

  // Meal Details
  type: text("type").notNull(), // breakfast, lunch, dinner, snack
  time: text("time").notNull(), // HH:MM format
  items: jsonb("items").notNull().default([]), // array of food items
  calories: integer("calories").notNull().default(0),
  order: integer("order").notNull().default(0),
}, (table) => ({
  planIdIdx: index("app_diet_meals_plan_id_idx").on(table.planId),
  planOrderIdx: index("app_diet_meals_plan_order_idx").on(table.planId, table.order),
}));

export const appOnboardingSlidesTable = pgTable("app_onboarding_slides", {
  id: serial("id").primaryKey(),

  // Multi-tenancy
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gymsTable.id, { onDelete: "cascade" }),

  // Slide Details
  order: integer("order").notNull().default(0),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),

  isActive: boolean("is_active").notNull().default(true),

  // Audit Trail
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  gymIdIdx: index("app_onboarding_slides_gym_id_idx").on(table.gymId),
  gymOrderIdx: index("app_onboarding_slides_gym_order_idx").on(table.gymId, table.order),
}));
