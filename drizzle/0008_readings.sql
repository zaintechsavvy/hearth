CREATE TABLE "reading" (
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"value" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading" ADD CONSTRAINT "reading_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_device_idx" ON "reading" USING btree ("user_id","device_id","at");