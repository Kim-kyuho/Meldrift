ALTER TABLE "boards" ADD COLUMN "collab_flg" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_collab_flg_check" CHECK ("boards"."collab_flg" IN (0, 1));