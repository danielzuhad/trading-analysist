ALTER TABLE "analysis_outcomes" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "analysis_outcomes" ADD COLUMN "key_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;