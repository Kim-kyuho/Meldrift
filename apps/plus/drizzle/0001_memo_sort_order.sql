ALTER TABLE "memos" ADD COLUMN IF NOT EXISTS "sort_order" integer;--> statement-breakpoint
-- 기존 보드는 id 순서가 곧 탐색 순서였다. 아직 비어 있는 행만 보드마다 1부터 매긴다.
-- 이미 값이 있는 행은 사용자가 정한 순서일 수 있으므로 건드리지 않는다.
UPDATE "memos" AS m
SET "sort_order" = ranked.rn
FROM (
	SELECT "id", ROW_NUMBER() OVER (PARTITION BY "board_id" ORDER BY "id") AS rn
	FROM "memos"
) AS ranked
WHERE m."id" = ranked."id" AND m."sort_order" IS NULL;--> statement-breakpoint
ALTER TABLE "memos" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "memos" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memos_board_id_sort_order_idx" ON "memos" USING btree ("board_id","sort_order");
