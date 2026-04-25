CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"watchlist_id" text,
	"position_id" text,
	"analysis_id" text,
	"transition_id" text,
	"timeframe" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"channels" jsonb NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"summary" text NOT NULL,
	"previous_state" text,
	"current_state" text NOT NULL,
	"suggestion" text,
	"created_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_stale" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_dedupe_key_unique" ON "alerts" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "alerts_asset_timeframe_created_at_idx" ON "alerts" USING btree ("asset_id","timeframe","created_at");--> statement-breakpoint
CREATE INDEX "alerts_status_created_at_idx" ON "alerts" USING btree ("status","created_at");