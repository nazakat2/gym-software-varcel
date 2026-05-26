import { pgTable, serial, text, boolean, timestamp, integer, jsonb, bigint, foreignKey, numeric, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const appAnnouncements = pgTable("app_announcements", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	body: text().notNull(),
	type: text().default('info').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const appClassBookings = pgTable("app_class_bookings", {
	id: serial().primaryKey().notNull(),
	classId: integer("class_id").notNull(),
	memberEmail: text("member_email").notNull(),
	bookedAt: timestamp("booked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: text().default('confirmed').notNull(),
});

export const appClasses = pgTable("app_classes", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().default('Other').notNull(),
	instructor: text().notNull(),
	time: text().notNull(),
	date: text().notNull(),
	duration: integer().default(60).notNull(),
	capacity: integer().default(20).notNull(),
	enrolled: integer().default(0).notNull(),
	location: text().default('Main Floor').notNull(),
	level: text().default('All levels').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const appDietMeals = pgTable("app_diet_meals", {
	id: serial().primaryKey().notNull(),
	planId: integer("plan_id").notNull(),
	type: text().notNull(),
	time: text().notNull(),
	items: jsonb().default([]).notNull(),
	calories: integer().default(0).notNull(),
	order: integer().default(0).notNull(),
});

export const appDietPlans = pgTable("app_diet_plans", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	goal: text().default('General health').notNull(),
	calories: integer().default(2000).notNull(),
	protein: integer().default(100).notNull(),
	carbs: integer().default(250).notNull(),
	fat: integer().default(70).notNull(),
	dietitian: text().default(').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const appOnboardingSlides = pgTable("app_onboarding_slides", {
	id: serial().primaryKey().notNull(),
	order: integer().default(0).notNull(),
	title: text().notNull(),
	subtitle: text().default(').notNull(),
	description: text().default(').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const appWorkoutExercises = pgTable("app_workout_exercises", {
	id: serial().primaryKey().notNull(),
	planId: integer("plan_id").notNull(),
	name: text().notNull(),
	sets: integer().default(3).notNull(),
	reps: text().default('10').notNull(),
	rest: text().default('60s').notNull(),
	order: integer().default(0).notNull(),
});

export const members = pgTable("members", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	phone: text().notNull(),
	cnic: text().notNull(),
	address: text(),
	photoUrl: text("photo_url"),
	plan: text().default('monthly').notNull(),
	planStartDate: text("plan_start_date").notNull(),
	planExpiryDate: text("plan_expiry_date").notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	whatsapp: text(),
	email: text(),
	gender: text().default('male'),
	dob: text(),
	city: text(),
	area: text(),
	bloodGroup: text("blood_group"),
	emergencyContactName: text("emergency_contact_name"),
	emergencyContactPhone: text("emergency_contact_phone"),
	fitnessGoal: text("fitness_goal").default('general'),
	referralSource: text("referral_source"),
	frozenUntil: text("frozen_until"),
	assignedTrainerId: integer("assigned_trainer_id"),
	blacklisted: boolean().default(false),
});

export const appWorkoutPlans = pgTable("app_workout_plans", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	goal: text().default('General fitness').notNull(),
	level: text().default('Beginner').notNull(),
	duration: text().default('4 weeks').notNull(),
	daysPerWeek: integer("days_per_week").default(3).notNull(),
	trainer: text().default(').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const otps = pgTable("otps", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	otp: text().notNull(),
	type: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
	data: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const attendance = pgTable("attendance", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id").notNull(),
	date: text().notNull(),
	checkInTime: text("check_in_time").notNull(),
	checkOutTime: text("check_out_time"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "attendance_member_id_members_id_fk"
		}).onDelete("cascade"),
]);

export const posOrders = pgTable("pos_orders", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id"),
	customerName: text("customer_name"),
	discount: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	discountType: text("discount_type").default('fixed').notNull(),
	subtotal: numeric({ precision: 10, scale:  2 }).notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	paidAmount: numeric("paid_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	dueAmount: numeric("due_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	paymentMethod: text("payment_method").default('cash').notNull(),
	status: text().default('paid').notNull(),
	notes: text(),
	date: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "pos_orders_member_id_members_id_fk"
		}).onDelete("set null"),
]);

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	stock: integer().default(0).notNull(),
	supplierId: integer("supplier_id"),
	lowStockThreshold: integer("low_stock_threshold").default(5).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "products_supplier_id_suppliers_id_fk"
		}).onDelete("set null"),
]);

export const suppliers = pgTable("suppliers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	contact: text().notNull(),
	email: text(),
	address: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const sales = pgTable("sales", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id").notNull(),
	quantity: integer().notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	status: text().default('paid').notNull(),
	customerName: text("customer_name"),
	date: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sales_product_id_products_id_fk"
		}).onDelete("restrict"),
]);

export const employees = pgTable("employees", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	role: text().default('staff').notNull(),
	phone: text().notNull(),
	email: text(),
	salary: numeric({ precision: 10, scale:  2 }).notNull(),
	commission: numeric({ precision: 10, scale:  2 }).default('0'),
	assignedMembers: integer("assigned_members").default(0),
	joinDate: text("join_date").notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cnic: text(),
	homeAddress: text("home_address"),
	totalEarnings: numeric("total_earnings", { precision: 12, scale:  2 }).default('0'),
});

export const invoices = pgTable("invoices", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	plan: text().notNull(),
	dueDate: text("due_date").notNull(),
	paidDate: text("paid_date"),
	status: text().default('unpaid').notNull(),
	paymentMethod: text("payment_method"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	subscriptionId: integer("subscription_id"),
	trainerCommission: numeric("trainer_commission", { precision: 10, scale:  2 }),
	gymRevenue: numeric("gym_revenue", { precision: 10, scale:  2 }),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "invoices_member_id_members_id_fk"
		}).onDelete("cascade"),
]);

export const measurements = pgTable("measurements", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id").notNull(),
	weight: numeric({ precision: 5, scale:  1 }).notNull(),
	height: numeric({ precision: 5, scale:  1 }).notNull(),
	bmi: numeric({ precision: 6, scale:  1 }).notNull(),
	bodyFat: numeric("body_fat", { precision: 4, scale:  1 }),
	date: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chest: numeric({ precision: 5, scale:  1 }),
	waist: numeric({ precision: 5, scale:  1 }),
	arms: numeric({ precision: 5, scale:  1 }),
	hips: numeric({ precision: 5, scale:  1 }),
	notes: text(),
	beforePhoto: text("before_photo"),
	afterPhoto: text("after_photo"),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "measurements_member_id_members_id_fk"
		}).onDelete("cascade"),
]);

export const adminUsers = pgTable("admin_users", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	password: text(),
	role: text().default('staff').notNull(),
	permissions: text().array().default([""]).notNull(),
	lastLogin: text("last_login"),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("admin_users_email_unique").on(table.email),
]);

export const adminNotifications = pgTable("admin_notifications", {
	id: serial().primaryKey().notNull(),
	type: text().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	read: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const posOrderItems = pgTable("pos_order_items", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	productId: integer("product_id"),
	productName: text("product_name").notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	quantity: integer().notNull(),
	subtotal: numeric({ precision: 10, scale:  2 }).notNull(),
	returned: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [posOrders.id],
			name: "pos_order_items_order_id_pos_orders_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "pos_order_items_product_id_products_id_fk"
		}).onDelete("set null"),
]);

export const accounts = pgTable("accounts", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	balance: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const vouchers = pgTable("vouchers", {
	id: serial().primaryKey().notNull(),
	accountId: integer("account_id").notNull(),
	type: text().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	description: text().notNull(),
	date: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "vouchers_account_id_accounts_id_fk"
		}).onDelete("restrict"),
]);

export const businessSettings = pgTable("business_settings", {
	id: serial().primaryKey().notNull(),
	gymName: text("gym_name").notNull(),
	address: text().notNull(),
	phone: text().notNull(),
	email: text().notNull(),
	logoUrl: text("logo_url"),
	currency: text().default('PKR').notNull(),
	timezone: text().default('Asia/Karachi').notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	dailyFee: numeric("daily_fee", { precision: 10, scale:  2 }).default('200'),
	weeklyFee: numeric("weekly_fee", { precision: 10, scale:  2 }).default('800'),
	monthlyFee: numeric("monthly_fee", { precision: 10, scale:  2 }).default('3000'),
	quarterlyFee: numeric("quarterly_fee", { precision: 10, scale:  2 }).default('8000'),
	yearlyFee: numeric("yearly_fee", { precision: 10, scale:  2 }).default('28000'),
});

export const membershipHistory = pgTable("membership_history", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id").notNull(),
	plan: text().notNull(),
	startDate: text("start_date").notNull(),
	expiryDate: text("expiry_date").notNull(),
	amount: numeric({ precision: 10, scale:  2 }),
	status: text().default('completed').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "membership_history_member_id_members_id_fk"
		}).onDelete("cascade"),
]);

export const memberHealth = pgTable("member_health", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id").notNull(),
	conditions: jsonb().default([]),
	allergies: text(),
	medicalHistory: text("medical_history"),
	doctorRecommendations: text("doctor_recommendations"),
	currentMedications: text("current_medications"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "member_health_member_id_members_id_fk"
		}).onDelete("cascade"),
]);

export const memberNotes = pgTable("member_notes", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id").notNull(),
	note: text().notNull(),
	type: text().default('admin').notNull(),
	createdBy: text("created_by").default('Admin').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "member_notes_member_id_members_id_fk"
		}).onDelete("cascade"),
]);

export const clientSubscriptions = pgTable("client_subscriptions", {
	id: serial().primaryKey().notNull(),
	memberId: integer("member_id").notNull(),
	trainerId: integer("trainer_id").notNull(),
	planId: integer("plan_id"),
	startDate: text("start_date").notNull(),
	endDate: text("end_date"),
	purpose: text(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "client_subscriptions_member_id_members_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.trainerId],
			foreignColumns: [employees.id],
			name: "client_subscriptions_trainer_id_employees_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plans.id],
			name: "client_subscriptions_plan_id_plans_id_fk"
		}).onDelete("set null"),
]);

export const plans = pgTable("plans", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	totalFee: numeric("total_fee", { precision: 10, scale:  2 }).notNull(),
	commissionType: text("commission_type").default('percentage').notNull(),
	commissionValue: numeric("commission_value", { precision: 10, scale:  2 }).default('0').notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const trainerEarnings = pgTable("trainer_earnings", {
	id: serial().primaryKey().notNull(),
	trainerId: integer("trainer_id").notNull(),
	sourcePaymentId: integer("source_payment_id").notNull(),
	subscriptionId: integer("subscription_id"),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	date: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.trainerId],
			foreignColumns: [employees.id],
			name: "trainer_earnings_trainer_id_employees_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourcePaymentId],
			foreignColumns: [invoices.id],
			name: "trainer_earnings_source_payment_id_invoices_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [clientSubscriptions.id],
			name: "trainer_earnings_subscription_id_client_subscriptions_id_fk"
		}).onDelete("set null"),
]);
