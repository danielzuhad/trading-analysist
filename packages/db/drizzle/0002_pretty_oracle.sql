CREATE TABLE "indicator_latest_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"timeframe" text NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL,
	"moving_averages" jsonb NOT NULL,
	"oscillators" jsonb NOT NULL,
	"volatility" jsonb NOT NULL,
	"volume" jsonb NOT NULL,
	"levels" jsonb NOT NULL,
	"structure" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
