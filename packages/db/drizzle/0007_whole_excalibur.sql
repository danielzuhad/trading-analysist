CREATE TABLE "analysis_outcomes" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"timeframe" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"model_used" text NOT NULL,
	"prompt_version" text NOT NULL,
	"state" text NOT NULL,
	"suggestion" text NOT NULL,
	"bias" text NOT NULL,
	"signal_strength_score" integer NOT NULL,
	"ai_confidence" integer NOT NULL,
	"key_levels" jsonb NOT NULL,
	"price_at_analysis" text NOT NULL,
	"analysis_generated_at" timestamp with time zone NOT NULL,
	"evaluate_after" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"evaluated_at" timestamp with time zone,
	"price_at_evaluation" text,
	"price_change_percent" text,
	"direction_correct" boolean,
	"invalidation_hit" boolean,
	"candles_covered" integer,
	"metadata" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analysis_outcomes_status_evaluate_after_idx" ON "analysis_outcomes" USING btree ("status","evaluate_after");--> statement-breakpoint
CREATE INDEX "analysis_outcomes_asset_timeframe_generated_at_idx" ON "analysis_outcomes" USING btree ("asset_id","timeframe","analysis_generated_at");