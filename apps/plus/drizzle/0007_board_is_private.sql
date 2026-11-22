ALTER TABLE "boards" ADD COLUMN "is_private" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_is_private_check" CHECK ("boards"."is_private" IN (0, 1));