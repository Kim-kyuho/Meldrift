CREATE TABLE "board_snapshots" (
	"board_id" integer PRIMARY KEY NOT NULL,
	"snapshot" "bytea" NOT NULL,
	"format_version" integer NOT NULL,
	"revision" integer NOT NULL,
	"mutation_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_leases" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"session_hash" text NOT NULL,
	"tab_id" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
