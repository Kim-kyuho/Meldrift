CREATE TABLE "board_members" (
	"board_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(16) NOT NULL,
	"added_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_members_board_id_user_id_pk" PRIMARY KEY("board_id","user_id"),
	CONSTRAINT "board_members_role_check" CHECK ("board_members"."role" IN ('editor', 'viewer'))
);
--> statement-breakpoint
ALTER TABLE "sync_mutations" ADD COLUMN "touched" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_mutations" ADD COLUMN "operations" jsonb;--> statement-breakpoint
ALTER TABLE "sync_mutations" ADD COLUMN "author_id" integer;--> statement-breakpoint
ALTER TABLE "sync_mutations" ADD COLUMN "author_client" text;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_boards_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_members_user_idx" ON "board_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_mutations_board_revision_idx" ON "sync_mutations" USING btree ("board_id","revision");