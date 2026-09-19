ALTER TABLE "board_sync" ADD COLUMN IF NOT EXISTS "mode" varchar(16) DEFAULT 'snapshot' NOT NULL;--> statement-breakpoint
ALTER TABLE "board_sync" DROP CONSTRAINT IF EXISTS "board_sync_mode_check";--> statement-breakpoint
ALTER TABLE "board_sync" ADD CONSTRAINT "board_sync_mode_check" CHECK ("board_sync"."mode" IN ('snapshot', 'migrating', 'delta'));--> statement-breakpoint
ALTER TABLE "drawing_strokes" ADD COLUMN IF NOT EXISTS "seq" bigserial NOT NULL;
