CREATE TABLE "service_heartbeats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb DEFAULT 'null'::jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_heartbeats_service_name_unique" UNIQUE("service_name")
);
