CREATE TABLE IF NOT EXISTS "board_sync" (
	"board_id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"format_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_mutations" (
	"board_id" integer NOT NULL,
	"mutation_id" text NOT NULL,
	"digest" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_mutations_board_id_mutation_id_pk" PRIMARY KEY("board_id","mutation_id")
);
--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "sync_id" text;--> statement-breakpoint
ALTER TABLE "memos" ADD COLUMN IF NOT EXISTS "sync_id" text;--> statement-breakpoint
ALTER TABLE "mermaids" ADD COLUMN IF NOT EXISTS "sync_id" text;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "sync_id" text;--> statement-breakpoint
UPDATE "memos" SET "sync_id" = 'memo-' || "id" WHERE "sync_id" IS NULL;--> statement-breakpoint
UPDATE "images" SET "sync_id" = 'image-' || "image_id" WHERE "sync_id" IS NULL;--> statement-breakpoint
UPDATE "mermaids" SET "sync_id" = 'mermaid-' || "mermaid_id" WHERE "sync_id" IS NULL;--> statement-breakpoint
UPDATE "tables" SET "sync_id" = 'table-' || "table_id" WHERE "sync_id" IS NULL;--> statement-breakpoint
ALTER TABLE "memos" ALTER COLUMN "sync_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "sync_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mermaids" ALTER COLUMN "sync_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ALTER COLUMN "sync_id" SET NOT NULL;--> statement-breakpoint
INSERT INTO "board_sync" ("board_id", "revision")
SELECT b."board_id", COALESCE(s."revision", 0)
FROM "boards" b LEFT JOIN "board_snapshots" s ON s."board_id" = b."board_id"
ON CONFLICT ("board_id") DO NOTHING;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_mutations_created_at_idx" ON "sync_mutations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "images_sync_id_idx" ON "images" USING btree ("board_id","sync_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memos_sync_id_idx" ON "memos" USING btree ("board_id","sync_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mermaids_sync_id_idx" ON "mermaids" USING btree ("board_id","sync_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tables_sync_id_idx" ON "tables" USING btree ("board_id","sync_id");
