ALTER TABLE "activity" ADD COLUMN "dedupe" text;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_dedupe_idx" ON "activity" USING btree ("user_id","dedupe");