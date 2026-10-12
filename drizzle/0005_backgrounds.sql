CREATE TABLE "background" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "background" ADD CONSTRAINT "background_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "background_user_idx" ON "background" USING btree ("user_id");