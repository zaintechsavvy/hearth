CREATE TABLE "demo_state" (
	"integration_id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"devices" jsonb NOT NULL,
	"lists" jsonb NOT NULL,
	"moving" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demo_state" ADD CONSTRAINT "demo_state_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE no action;