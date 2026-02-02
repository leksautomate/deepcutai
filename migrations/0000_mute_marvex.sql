CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"api_key" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"category" text DEFAULT 'system' NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"project_id" varchar,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_analytics" (
	"id" varchar PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"videos_created" integer DEFAULT 0,
	"videos_rendered" integer DEFAULT 0,
	"scripts_generated" integer DEFAULT 0,
	"images_generated" integer DEFAULT 0,
	"audio_generated" integer DEFAULT 0,
	"total_duration_seconds" real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "video_projects" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"script" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"voice_id" text,
	"image_style" text,
	"image_generator" text DEFAULT 'seedream',
	"manifest" jsonb,
	"output_path" text,
	"thumbnail_path" text,
	"chapters" jsonb,
	"progress" integer DEFAULT 0,
	"progress_message" text,
	"error_message" text,
	"total_duration" real,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_project_id_video_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_provider_idx" ON "api_keys" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "system_logs_level_idx" ON "system_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "system_logs_category_idx" ON "system_logs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "system_logs_created_at_idx" ON "system_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "system_logs_project_id_idx" ON "system_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "usage_analytics_date_idx" ON "usage_analytics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "video_projects_status_idx" ON "video_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "video_projects_created_at_idx" ON "video_projects" USING btree ("created_at");