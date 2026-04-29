CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"watchlist_id" text,
	"source_account" text,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"quote_currency" text,
	"entry_price" text NOT NULL,
	"average_entry_price" text NOT NULL,
	"quantity" text NOT NULL,
	"remaining_quantity" text NOT NULL,
	"notional_value" text,
	"realized_pnl" text,
	"unrealized_pnl" text,
	"realized_pnl_percent" text,
	"unrealized_pnl_percent" text,
	"stop_loss" text,
	"take_profit_levels" jsonb NOT NULL,
	"thesis" text,
	"notes" text,
	"latest_state" text,
	"latest_suggestion" text,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"last_updated_at" timestamp with time zone NOT NULL,
	"is_backfilled" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "positions_user_status_opened_at_idx" ON "positions" USING btree ("user_id","status","opened_at");--> statement-breakpoint
CREATE INDEX "positions_asset_status_opened_at_idx" ON "positions" USING btree ("asset_id","status","opened_at");