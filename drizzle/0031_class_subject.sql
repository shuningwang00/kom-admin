ALTER TABLE "classes" ADD COLUMN "subject" text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE "classes" SET "subject" = "label";
