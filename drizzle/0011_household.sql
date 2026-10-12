CREATE TABLE "invite" (
	"code" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"role" text NOT NULL,
	"pages" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"member_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"role" text NOT NULL,
	"pages" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_owner_idx" ON "invite" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "membership_owner_idx" ON "membership" USING btree ("owner_id");