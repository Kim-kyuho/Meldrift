CREATE TABLE "board_previews" (
	"board_id" integer PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"mime_type" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "private_flg" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ALTER COLUMN "private_flg" SET DEFAULT 1;--> statement-breakpoint
UPDATE "boards" SET "private_flg" = 1 WHERE "private_flg" IS NULL;--> statement-breakpoint
ALTER TABLE "boards" ALTER COLUMN "private_flg" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "board_previews" ADD CONSTRAINT "board_previews_board_id_boards_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boards_owner_id_idx" ON "boards" USING btree ("owner_id");--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_private_flg_check'
    ) THEN
        ALTER TABLE "boards" ADD CONSTRAINT "boards_private_flg_check" CHECK ("private_flg" IN (0, 1));
    END IF;
END $$;
