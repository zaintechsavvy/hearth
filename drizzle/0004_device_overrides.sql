CREATE TABLE "device_override" (
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"name" text,
	"room" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "device_override_user_id_device_id_pk" PRIMARY KEY("user_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "preference" ADD COLUMN "rooms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "device_override" ADD CONSTRAINT "device_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;