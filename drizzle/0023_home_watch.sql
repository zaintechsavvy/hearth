CREATE TABLE "home_watch" (
	"user_id" text PRIMARY KEY NOT NULL,
	"devices" jsonb NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "home_watch" ADD CONSTRAINT "home_watch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;