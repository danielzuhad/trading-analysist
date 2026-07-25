CREATE TABLE "watchlist_assets" (
	"asset_id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"coingecko_coin_id" text NOT NULL,
	"asset" jsonb NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_assets_symbol_unique" ON "watchlist_assets" USING btree ("symbol");