ALTER TABLE "api_tokens" ADD COLUMN "expires_at" timestamp with time zone DEFAULT (now() + interval '30 days') NOT NULL;
ALTER TABLE "api_tokens" ALTER COLUMN "expires_at" DROP DEFAULT;