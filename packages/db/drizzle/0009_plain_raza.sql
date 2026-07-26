CREATE TABLE "ai_cost_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" text NOT NULL,
	"timeframe" text NOT NULL,
	"analysis_id" text NOT NULL,
	"cost_estimate_usd" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"telegram_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "ai_cost_ledger" ADD CONSTRAINT "ai_cost_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_user_generated_at_idx" ON "ai_cost_ledger" USING btree ("user_id","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_token_hash_unique" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint

-- Seed a bootstrap admin user so pre-existing watchlist_assets rows (created
-- before multi-user support existed) have a real owner to backfill onto.
-- Change the email below before running in a real environment; the password
-- hash is intentionally invalid (login must happen via a freshly issued
-- token, e.g. through a one-off admin script) until reset.
INSERT INTO "users" ("id", "email", "password_hash", "role")
VALUES (gen_random_uuid(), 'admin@local.invalid', 'unset', 'admin')
ON CONFLICT ("email") DO NOTHING;--> statement-breakpoint

DROP INDEX "watchlist_assets_symbol_unique";--> statement-breakpoint
ALTER TABLE "watchlist_assets" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_assets" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- Backfill existing rows (from the single-tenant era) onto the bootstrap admin.
UPDATE "watchlist_assets"
SET "user_id" = (SELECT "id" FROM "users" WHERE "email" = 'admin@local.invalid')
WHERE "user_id" IS NULL;--> statement-breakpoint

ALTER TABLE "watchlist_assets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_assets" DROP CONSTRAINT "watchlist_assets_pkey";--> statement-breakpoint
ALTER TABLE "watchlist_assets" ADD CONSTRAINT "watchlist_assets_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "watchlist_assets" ADD CONSTRAINT "watchlist_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_assets_user_symbol_unique" ON "watchlist_assets" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_assets_user_asset_unique" ON "watchlist_assets" USING btree ("user_id","asset_id");--> statement-breakpoint
CREATE INDEX "watchlist_assets_user_id_idx" ON "watchlist_assets" USING btree ("user_id");