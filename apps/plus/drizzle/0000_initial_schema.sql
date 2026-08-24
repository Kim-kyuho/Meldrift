CREATE TABLE IF NOT EXISTS "boards" (
	"board_id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drawings" (
	"drawing_id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"source" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drawings_board_id_unique" UNIQUE("board_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "images" (
	"image_id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"public_id" text NOT NULL,
	"secure_url" text NOT NULL,
	"filename" text,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"z" integer DEFAULT 1 NOT NULL,
	"width" integer DEFAULT 300 NOT NULL,
	"height" integer DEFAULT 200 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "images_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memos" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"content" text NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"z" integer DEFAULT 1 NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mermaids" (
	"mermaid_id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"source" text NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"z" integer DEFAULT 1 NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tables" (
	"table_id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"source" jsonb NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"z" integer DEFAULT 1 NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"session_token_hash" varchar(64),
	"session_expires_at" timestamp,
	"permission_flg" boolean DEFAULT false NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('user', 'admin'))
);
