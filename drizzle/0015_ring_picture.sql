CREATE TABLE "ring_picture" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"camera_name" text NOT NULL,
	"content_type" text NOT NULL,
	"image" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ring_picture" ADD CONSTRAINT "ring_picture_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ring_picture_ring_idx" ON "ring_picture" USING btree ("user_id","device_id","at");