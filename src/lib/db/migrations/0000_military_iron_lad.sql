CREATE TYPE "public"."alert_type" AS ENUM('tvl_drop', 'utilization_spike', 'apy_anomaly', 'whale_movement', 'health_decrease');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid,
	"protocol" text NOT NULL,
	"network" text,
	"current_value" numeric(20, 6) NOT NULL,
	"message" text NOT NULL,
	"severity" "severity" NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "alert_type" NOT NULL,
	"protocol" text NOT NULL,
	"network" text,
	"condition" text NOT NULL,
	"threshold" numeric(20, 6) NOT NULL,
	"severity" "severity" NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_tvl" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_id" uuid NOT NULL,
	"timestamp" timestamp NOT NULL,
	"tvl" numeric(20, 2) NOT NULL,
	"chain" text DEFAULT 'Base' NOT NULL,
	"source" text DEFAULT 'defillama' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_id" uuid NOT NULL,
	"asset" text NOT NULL,
	"supply_apy" numeric(10, 6),
	"borrow_apy" numeric(10, 6),
	"total_supply_usd" numeric(20, 2),
	"total_borrow_usd" numeric(20, 2),
	"tvl_usd" numeric(20, 2),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"logo_url" text,
	"chain" text DEFAULT 'Base' NOT NULL,
	"coingecko_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"favorite_protocols" jsonb DEFAULT '[]'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_tvl" ADD CONSTRAINT "historical_tvl_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_events_triggered_idx" ON "alert_events" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "alert_events_protocol_idx" ON "alert_events" USING btree ("protocol");--> statement-breakpoint
CREATE INDEX "alert_events_severity_idx" ON "alert_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alert_events_dashboard_idx" ON "alert_events" USING btree ("severity","acknowledged","triggered_at");--> statement-breakpoint
CREATE INDEX "alert_events_network_idx" ON "alert_events" USING btree ("network");--> statement-breakpoint
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "alert_rules_protocol_idx" ON "alert_rules" USING btree ("protocol");--> statement-breakpoint
CREATE INDEX "alert_rules_network_idx" ON "alert_rules" USING btree ("network");--> statement-breakpoint
CREATE UNIQUE INDEX "api_cache_key_idx" ON "api_cache" USING btree ("key");--> statement-breakpoint
CREATE INDEX "api_cache_expires_idx" ON "api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "historical_tvl_timestamp_idx" ON "historical_tvl" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "historical_tvl_protocol_idx" ON "historical_tvl" USING btree ("protocol_id");--> statement-breakpoint
CREATE INDEX "historical_tvl_chain_idx" ON "historical_tvl" USING btree ("chain");--> statement-breakpoint
CREATE INDEX "historical_tvl_protocol_ts_idx" ON "historical_tvl" USING btree ("protocol_id","timestamp");--> statement-breakpoint
CREATE INDEX "markets_protocol_idx" ON "markets" USING btree ("protocol_id");--> statement-breakpoint
CREATE INDEX "markets_asset_idx" ON "markets" USING btree ("asset");--> statement-breakpoint
CREATE UNIQUE INDEX "protocols_slug_idx" ON "protocols" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "protocols_chain_idx" ON "protocols" USING btree ("chain");--> statement-breakpoint
CREATE UNIQUE INDEX "user_prefs_user_idx" ON "user_preferences" USING btree ("user_id");