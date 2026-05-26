ALTER TABLE "admin_users" ADD COLUMN "gym_id" uuid;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "gym_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;