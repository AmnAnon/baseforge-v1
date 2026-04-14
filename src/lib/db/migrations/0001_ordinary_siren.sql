CREATE TABLE "api_key_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"method" text DEFAULT 'GET' NOT NULL,
	"status_code" integer,
	"latency_ms" integer,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"rate_limit" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "frame_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fid" integer,
	"button_index" integer NOT NULL,
	"action" text,
	"cast_fid" integer,
	"cast_hash" text,
	"message_hash" text,
	"address" text,
	"tab" text,
	"protocol" text,
	"route" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key_usage" ADD CONSTRAINT "api_key_usage_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_usage_key_id_idx" ON "api_key_usage" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "api_key_usage_created_idx" ON "api_key_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_key_usage_endpoint_idx" ON "api_key_usage" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_idx" ON "api_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "api_keys_tier_idx" ON "api_keys" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "api_keys_enabled_idx" ON "api_keys" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "frame_interactions_fid_idx" ON "frame_interactions" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "frame_interactions_route_idx" ON "frame_interactions" USING btree ("route");--> statement-breakpoint
CREATE INDEX "frame_interactions_created_idx" ON "frame_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "frame_interactions_tab_idx" ON "frame_interactions" USING btree ("tab");