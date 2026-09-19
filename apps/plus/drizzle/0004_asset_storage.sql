CREATE TABLE IF NOT EXISTS "asset_chunks" (
	"board_id" integer NOT NULL,
	"asset_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	CONSTRAINT "asset_chunks_board_id_asset_id_chunk_index_pk" PRIMARY KEY("board_id","asset_id","chunk_index")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"board_id" integer NOT NULL,
	"asset_id" text NOT NULL,
	"digest" text NOT NULL,
	"byte_length" integer NOT NULL,
	"mime_type" text NOT NULL,
	"chunk_size" integer NOT NULL,
	"chunk_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_board_id_asset_id_pk" PRIMARY KEY("board_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drawing_strokes" (
	"board_id" integer NOT NULL,
	"sync_id" text NOT NULL,
	"color" text NOT NULL,
	"width" double precision NOT NULL,
	"points" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_strokes_board_id_sync_id_pk" PRIMARY KEY("board_id","sync_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upload_sessions" (
	"upload_id" text PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"asset_id" text NOT NULL,
	"digest" text NOT NULL,
	"byte_length" integer NOT NULL,
	"mime_type" text NOT NULL,
	"chunk_size" integer NOT NULL,
	"chunk_count" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "public_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "secure_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "asset_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "upload_sessions_asset_idx" ON "upload_sessions" USING btree ("board_id","asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_expires_at_idx" ON "upload_sessions" USING btree ("expires_at");--> statement-breakpoint
INSERT INTO "drawing_strokes" ("board_id", "sync_id", "color", "width", "points")
SELECT d."board_id", s->>'id', s->>'color', (s->>'width')::double precision, s->'points'
FROM "drawings" d, jsonb_array_elements(d."source") s
ON CONFLICT DO NOTHING;
