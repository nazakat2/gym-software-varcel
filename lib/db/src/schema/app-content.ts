import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const appAnnouncementsTable = pgTable("app_announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("info"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appClassesTable = pgTable("app_classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  instructor: text("instructor").notNull(),
  time: text("time").notNull(),
  date: text("date").notNull(),
  duration: integer("duration").notNull().default(60),
  capacity: integer("capacity").notNull().default(20),
  enrolled: integer("enrolled").notNull().default(0),
  location: text("location").notNull().default("Main Floor"),
  level: text("level").notNull().default("All levels"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appClassBookingsTable = pgTable("app_class_bookings", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  memberEmail: text("member_email").notNull(),
  bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("confirmed"),
});

export const appWorkoutPlansTable = pgTable("app_workout_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  goal: text("goal").notNull().default("General fitness"),
  level: text("level").notNull().default("Beginner"),
  duration: text("duration").notNull().default("4 weeks"),
  daysPerWeek: integer("days_per_week").notNull().default(3),
  trainer: text("trainer").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appWorkoutExercisesTable = pgTable("app_workout_exercises", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  name: text("name").notNull(),
  sets: integer("sets").notNull().default(3),
  reps: text("reps").notNull().default("10"),
  rest: text("rest").notNull().default("60s"),
  order: integer("order").notNull().default(0),
});

export const appDietPlansTable = pgTable("app_diet_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  goal: text("goal").notNull().default("General health"),
  calories: integer("calories").notNull().default(2000),
  protein: integer("protein").notNull().default(100),
  carbs: integer("carbs").notNull().default(250),
  fat: integer("fat").notNull().default(70),
  dietitian: text("dietitian").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appDietMealsTable = pgTable("app_diet_meals", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  type: text("type").notNull(),
  time: text("time").notNull(),
  items: jsonb("items").notNull().default([]),
  calories: integer("calories").notNull().default(0),
  order: integer("order").notNull().default(0),
});

export const appOnboardingSlidesTable = pgTable("app_onboarding_slides", {
  id: serial("id").primaryKey(),
  order: integer("order").notNull().default(0),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
