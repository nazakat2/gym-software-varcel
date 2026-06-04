CREATE TABLE "gyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"city" text,
	"logo_url" text,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"daily_fee" numeric(10, 2) DEFAULT '200',
	"weekly_fee" numeric(10, 2) DEFAULT '800',
	"monthly_fee" numeric(10, 2) DEFAULT '3000',
	"quarterly_fee" numeric(10, 2) DEFAULT '8000',
	"yearly_fee" numeric(10, 2) DEFAULT '28000',
	"subscription_tier" text DEFAULT 'basic' NOT NULL,
	"subscription_status" text DEFAULT 'active' NOT NULL,
	"subscription_expires_at" timestamp,
	"stripe_customer_id" text,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "gyms_slug_unique" UNIQUE("slug"),
	CONSTRAINT "gyms_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'receptionist' NOT NULL,
	"permissions" text[] DEFAULT '{}',
	"status" text DEFAULT 'active' NOT NULL,
	"last_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"user_id" uuid,
	"user_name" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" integer NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"allergies" text,
	"medical_history" text,
	"doctor_recommendations" text,
	"current_medications" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" integer NOT NULL,
	"note" text NOT NULL,
	"type" text DEFAULT 'admin' NOT NULL,
	"created_by" uuid,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp" text,
	"email" text,
	"gender" text DEFAULT 'male',
	"dob" text,
	"cnic" text NOT NULL,
	"city" text,
	"area" text,
	"address" text,
	"blood_group" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"fitness_goal" text DEFAULT 'general',
	"referral_source" text,
	"photo_url" text,
	"plan" text DEFAULT 'monthly' NOT NULL,
	"plan_start_date" text NOT NULL,
	"plan_expiry_date" text NOT NULL,
	"frozen_until" text,
	"assigned_trainer_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"blacklisted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "membership_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" integer NOT NULL,
	"plan" text NOT NULL,
	"start_date" text NOT NULL,
	"expiry_date" text NOT NULL,
	"amount" numeric(10, 2),
	"status" text DEFAULT 'completed' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" integer NOT NULL,
	"weight" numeric(5, 1) NOT NULL,
	"height" numeric(5, 1) NOT NULL,
	"bmi" numeric(6, 1) NOT NULL,
	"body_fat" numeric(4, 1),
	"chest" numeric(5, 1),
	"waist" numeric(5, 1),
	"arms" numeric(5, 1),
	"hips" numeric(5, 1),
	"thighs" numeric(5, 1),
	"calves" numeric(5, 1),
	"before_photo" text,
	"after_photo" text,
	"date" text NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" integer NOT NULL,
	"date" text NOT NULL,
	"check_in_time" text NOT NULL,
	"check_out_time" text,
	"check_in_method" text DEFAULT 'manual',
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"member_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"plan" text NOT NULL,
	"due_date" text NOT NULL,
	"paid_date" text,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"payment_method" text,
	"trainer_id" integer,
	"trainer_commission" numeric(10, 2),
	"gym_revenue" numeric(10, 2),
	"subscription_id" integer,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"phone" text NOT NULL,
	"cnic" text,
	"email" text,
	"home_address" text,
	"join_date" text NOT NULL,
	"salary" numeric(10, 2) NOT NULL,
	"commission_percentage" numeric(5, 2) DEFAULT '0',
	"total_earnings" numeric(12, 2) DEFAULT '0',
	"assigned_members" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"plan_id" integer,
	"start_date" text NOT NULL,
	"end_date" text,
	"purpose" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"total_fee" numeric(10, 2) NOT NULL,
	"commission_type" text DEFAULT 'percentage' NOT NULL,
	"commission_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trainer_earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"trainer_id" integer NOT NULL,
	"source_payment_id" integer NOT NULL,
	"subscription_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"date" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"returned" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"member_id" integer,
	"customer_name" text,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'fixed' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"due_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"notes" text,
	"date" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"supplier_id" integer,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"sku" text,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"customer_name" text,
	"date" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"email" text,
	"address" text,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"voucher_number" text NOT NULL,
	"account_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"date" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"monthly_price" numeric(10, 2) NOT NULL,
	"yearly_price" numeric(10, 2) NOT NULL,
	"stripe_product_id" text,
	"stripe_monthly_price_id" text,
	"stripe_yearly_price_id" text,
	"features" text[] DEFAULT '{}' NOT NULL,
	"max_members" numeric(10, 0),
	"max_staff" numeric(10, 0),
	"max_branches" numeric(10, 0) DEFAULT '1',
	"is_active" boolean DEFAULT true,
	"display_order" numeric(3, 0) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"status" text DEFAULT 'trial' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "payment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"subscription_id" uuid,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"stripe_charge_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"status" text NOT NULL,
	"payment_method" text,
	"card_last4" text,
	"card_brand" text,
	"description" text,
	"invoice_url" text,
	"paid_at" timestamp,
	"failed_at" timestamp,
	"refunded_at" timestamp,
	"failure_reason" text,
	"failure_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_history_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid,
	"email" text NOT NULL,
	"otp" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"action_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_class_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"class_id" integer NOT NULL,
	"member_email" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"instructor" text NOT NULL,
	"time" text NOT NULL,
	"date" text NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"capacity" integer DEFAULT 20 NOT NULL,
	"enrolled" integer DEFAULT 0 NOT NULL,
	"location" text DEFAULT 'Main Floor' NOT NULL,
	"level" text DEFAULT 'All levels' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_diet_meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"type" text NOT NULL,
	"time" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calories" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_diet_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT 'General health' NOT NULL,
	"calories" integer DEFAULT 2000 NOT NULL,
	"protein" integer DEFAULT 100 NOT NULL,
	"carbs" integer DEFAULT 250 NOT NULL,
	"fat" integer DEFAULT 70 NOT NULL,
	"dietitian" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_onboarding_slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_workout_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"name" text NOT NULL,
	"sets" integer DEFAULT 3 NOT NULL,
	"reps" text DEFAULT '10' NOT NULL,
	"rest" text DEFAULT '60s' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_workout_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT 'General fitness' NOT NULL,
	"level" text DEFAULT 'Beginner' NOT NULL,
	"duration" text DEFAULT '4 weeks' NOT NULL,
	"days_per_week" integer DEFAULT 3 NOT NULL,
	"trainer" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"city" text,
	"manager_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"logo_url" text,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"daily_fee" numeric(10, 2) DEFAULT '200',
	"weekly_fee" numeric(10, 2) DEFAULT '800',
	"monthly_fee" numeric(10, 2) DEFAULT '3000',
	"quarterly_fee" numeric(10, 2) DEFAULT '8000',
	"yearly_fee" numeric(10, 2) DEFAULT '28000',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_health" ADD CONSTRAINT "member_health_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_health" ADD CONSTRAINT "member_health_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_trainer_id_employees_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_earnings" ADD CONSTRAINT "trainer_earnings_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_earnings" ADD CONSTRAINT "trainer_earnings_trainer_id_employees_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_earnings" ADD CONSTRAINT "trainer_earnings_source_payment_id_invoices_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_earnings" ADD CONSTRAINT "trainer_earnings_subscription_id_client_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."client_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_order_id_pos_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pos_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_announcements" ADD CONSTRAINT "app_announcements_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_class_bookings" ADD CONSTRAINT "app_class_bookings_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_class_bookings" ADD CONSTRAINT "app_class_bookings_class_id_app_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."app_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_classes" ADD CONSTRAINT "app_classes_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_diet_meals" ADD CONSTRAINT "app_diet_meals_plan_id_app_diet_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."app_diet_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_diet_plans" ADD CONSTRAINT "app_diet_plans_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_onboarding_slides" ADD CONSTRAINT "app_onboarding_slides_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_workout_exercises" ADD CONSTRAINT "app_workout_exercises_plan_id_app_workout_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."app_workout_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_workout_plans" ADD CONSTRAINT "app_workout_plans_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gyms_slug_idx" ON "gyms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "gyms_is_active_idx" ON "gyms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "audit_logs_gym_id_idx" ON "audit_logs" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_health_gym_id_idx" ON "member_health" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "member_health_member_id_idx" ON "member_health" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_notes_gym_id_idx" ON "member_notes" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "member_notes_member_id_idx" ON "member_notes" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_notes_created_at_idx" ON "member_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "members_gym_active_idx" ON "members" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE INDEX "members_gym_status_idx" ON "members" USING btree ("gym_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "members_gym_phone_unique" ON "members" USING btree ("gym_id","phone") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "members_gym_cnic_unique" ON "members" USING btree ("gym_id","cnic") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "members_gym_code_unique" ON "members" USING btree ("gym_id","member_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "membership_history_gym_id_idx" ON "membership_history" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "membership_history_member_id_idx" ON "membership_history" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "membership_history_created_at_idx" ON "membership_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "measurements_gym_id_idx" ON "measurements" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "measurements_member_id_idx" ON "measurements" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "measurements_date_idx" ON "measurements" USING btree ("date");--> statement-breakpoint
CREATE INDEX "measurements_gym_member_date_idx" ON "measurements" USING btree ("gym_id","member_id","date");--> statement-breakpoint
CREATE INDEX "attendance_gym_id_idx" ON "attendance" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "attendance_member_id_idx" ON "attendance" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "attendance_gym_date_idx" ON "attendance" USING btree ("gym_id","date");--> statement-breakpoint
CREATE INDEX "invoices_gym_id_idx" ON "invoices" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "invoices_member_id_idx" ON "invoices" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_gym_status_idx" ON "invoices" USING btree ("gym_id","status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "employees_gym_id_idx" ON "employees" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "employees_gym_role_idx" ON "employees" USING btree ("gym_id","role");--> statement-breakpoint
CREATE INDEX "employees_gym_status_idx" ON "employees" USING btree ("gym_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_gym_phone_unique" ON "employees" USING btree ("gym_id","phone") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "client_subscriptions_gym_id_idx" ON "client_subscriptions" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "client_subscriptions_member_id_idx" ON "client_subscriptions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "client_subscriptions_trainer_id_idx" ON "client_subscriptions" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "client_subscriptions_gym_status_idx" ON "client_subscriptions" USING btree ("gym_id","status");--> statement-breakpoint
CREATE INDEX "plans_gym_id_idx" ON "plans" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "plans_gym_active_idx" ON "plans" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE INDEX "trainer_earnings_gym_id_idx" ON "trainer_earnings" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "trainer_earnings_trainer_id_idx" ON "trainer_earnings" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "trainer_earnings_date_idx" ON "trainer_earnings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "trainer_earnings_gym_trainer_date_idx" ON "trainer_earnings" USING btree ("gym_id","trainer_id","date");--> statement-breakpoint
CREATE INDEX "pos_order_items_order_id_idx" ON "pos_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pos_order_items_product_id_idx" ON "pos_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "pos_orders_gym_id_idx" ON "pos_orders" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "pos_orders_member_id_idx" ON "pos_orders" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "pos_orders_date_idx" ON "pos_orders" USING btree ("date");--> statement-breakpoint
CREATE INDEX "pos_orders_gym_date_idx" ON "pos_orders" USING btree ("gym_id","date");--> statement-breakpoint
CREATE INDEX "pos_orders_status_idx" ON "pos_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_gym_id_idx" ON "products" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "products_gym_category_idx" ON "products" USING btree ("gym_id","category");--> statement-breakpoint
CREATE INDEX "products_gym_stock_idx" ON "products" USING btree ("gym_id","stock");--> statement-breakpoint
CREATE UNIQUE INDEX "products_gym_sku_unique" ON "products" USING btree ("gym_id","sku") WHERE sku IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sales_gym_id_idx" ON "sales" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "sales_product_id_idx" ON "sales" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("date");--> statement-breakpoint
CREATE INDEX "sales_gym_date_idx" ON "sales" USING btree ("gym_id","date");--> statement-breakpoint
CREATE INDEX "suppliers_gym_id_idx" ON "suppliers" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "accounts_gym_id_idx" ON "accounts" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "accounts_gym_type_idx" ON "accounts" USING btree ("gym_id","type");--> statement-breakpoint
CREATE INDEX "vouchers_gym_id_idx" ON "vouchers" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "vouchers_account_id_idx" ON "vouchers" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "vouchers_date_idx" ON "vouchers" USING btree ("date");--> statement-breakpoint
CREATE INDEX "vouchers_gym_date_idx" ON "vouchers" USING btree ("gym_id","date");--> statement-breakpoint
CREATE INDEX "subscription_plans_slug_idx" ON "subscription_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "subscription_plans_is_active_idx" ON "subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_gym_id_idx" ON "subscriptions" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "payment_history_gym_id_idx" ON "payment_history" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "payment_history_status_idx" ON "payment_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_history_stripe_payment_intent_id_idx" ON "payment_history" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_history_created_at_idx" ON "payment_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "otps_gym_id_idx" ON "otps" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "otps_email_idx" ON "otps" USING btree ("email");--> statement-breakpoint
CREATE INDEX "otps_expires_at_idx" ON "otps" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "admin_notifications_gym_id_idx" ON "admin_notifications" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "admin_notifications_user_id_idx" ON "admin_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_notifications_gym_user_read_idx" ON "admin_notifications" USING btree ("gym_id","user_id","read");--> statement-breakpoint
CREATE INDEX "admin_notifications_created_at_idx" ON "admin_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_announcements_gym_id_idx" ON "app_announcements" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "app_announcements_gym_active_idx" ON "app_announcements" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE INDEX "app_class_bookings_gym_id_idx" ON "app_class_bookings" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "app_class_bookings_class_id_idx" ON "app_class_bookings" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "app_class_bookings_member_email_idx" ON "app_class_bookings" USING btree ("member_email");--> statement-breakpoint
CREATE INDEX "app_classes_gym_id_idx" ON "app_classes" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "app_classes_gym_date_idx" ON "app_classes" USING btree ("gym_id","date");--> statement-breakpoint
CREATE INDEX "app_classes_gym_active_idx" ON "app_classes" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE INDEX "app_diet_meals_plan_id_idx" ON "app_diet_meals" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "app_diet_meals_plan_order_idx" ON "app_diet_meals" USING btree ("plan_id","order");--> statement-breakpoint
CREATE INDEX "app_diet_plans_gym_id_idx" ON "app_diet_plans" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "app_diet_plans_gym_active_idx" ON "app_diet_plans" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE INDEX "app_onboarding_slides_gym_id_idx" ON "app_onboarding_slides" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "app_onboarding_slides_gym_order_idx" ON "app_onboarding_slides" USING btree ("gym_id","order");--> statement-breakpoint
CREATE INDEX "app_workout_exercises_plan_id_idx" ON "app_workout_exercises" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "app_workout_exercises_plan_order_idx" ON "app_workout_exercises" USING btree ("plan_id","order");--> statement-breakpoint
CREATE INDEX "app_workout_plans_gym_id_idx" ON "app_workout_plans" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "app_workout_plans_gym_active_idx" ON "app_workout_plans" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE INDEX "branches_gym_id_idx" ON "branches" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "branches_gym_active_idx" ON "branches" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_gym_code_unique" ON "branches" USING btree ("gym_id","code") WHERE deleted_at IS NULL;