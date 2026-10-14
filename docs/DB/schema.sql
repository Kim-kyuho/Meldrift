-- Meldrift v1.3 Beta schema reference, 2026-10-14.
-- Mirrors apps/plus/lib/db/schema.ts; not an upgrade migration.
-- Apply versioned migrations from apps/plus/drizzle to existing databases.

CREATE TABLE public.users (
    id serial PRIMARY KEY,
    email varchar(254) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    session_token_hash varchar(64),
    session_expires_at timestamp without time zone,
    permission_flg boolean NOT NULL DEFAULT false,
    role varchar(20) NOT NULL DEFAULT 'user',
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
);

CREATE TABLE public.boards (
    board_id serial PRIMARY KEY,
    title text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    owner_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    preview_version bigint
);

CREATE TABLE public.memos (
    id serial PRIMARY KEY,
    board_id integer NOT NULL,
    sync_id text NOT NULL,
    content text NOT NULL,
    x integer NOT NULL DEFAULT 0,
    y integer NOT NULL DEFAULT 0,
    z integer NOT NULL DEFAULT 1,
    width integer NOT NULL,
    height integer NOT NULL,
    color text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE INDEX memos_board_id_sort_order_idx ON public.memos USING btree (board_id, sort_order);
CREATE UNIQUE INDEX memos_sync_id_idx ON public.memos USING btree (board_id, sync_id);

CREATE TABLE public.images (
    image_id serial PRIMARY KEY,
    board_id integer NOT NULL,
    sync_id text NOT NULL,
    asset_id text,
    public_id text UNIQUE,
    secure_url text,
    filename text,
    x integer NOT NULL DEFAULT 0,
    y integer NOT NULL DEFAULT 0,
    z integer NOT NULL DEFAULT 1,
    width integer NOT NULL DEFAULT 300,
    height integer NOT NULL DEFAULT 200,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.mermaids (
    mermaid_id serial PRIMARY KEY,
    board_id integer NOT NULL,
    sync_id text NOT NULL,
    source text NOT NULL,
    x integer NOT NULL DEFAULT 0,
    y integer NOT NULL DEFAULT 0,
    z integer NOT NULL DEFAULT 1,
    width integer NOT NULL,
    height integer NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.drawings (
    drawing_id serial PRIMARY KEY,
    board_id integer NOT NULL UNIQUE,
    source jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tables (
    table_id serial PRIMARY KEY,
    board_id integer NOT NULL,
    sync_id text NOT NULL,
    source jsonb NOT NULL,
    x integer NOT NULL DEFAULT 0,
    y integer NOT NULL DEFAULT 0,
    z integer NOT NULL DEFAULT 1,
    width integer NOT NULL,
    height integer NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.board_snapshots (
    board_id integer PRIMARY KEY,
    snapshot bytea NOT NULL,
    format_version integer NOT NULL,
    revision integer NOT NULL,
    mutation_id text NOT NULL,
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX images_sync_id_idx ON public.images USING btree (board_id, sync_id);
CREATE UNIQUE INDEX mermaids_sync_id_idx ON public.mermaids USING btree (board_id, sync_id);
CREATE UNIQUE INDEX tables_sync_id_idx ON public.tables USING btree (board_id, sync_id);

CREATE TABLE public.board_sync (
    board_id integer PRIMARY KEY,
    revision integer NOT NULL DEFAULT 0,
    format_version integer NOT NULL DEFAULT 1,
    mode varchar(16) NOT NULL DEFAULT 'snapshot',
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT board_sync_mode_check CHECK (mode IN ('snapshot', 'migrating', 'delta'))
);

CREATE TABLE public.sync_mutations (
    board_id integer NOT NULL,
    mutation_id text NOT NULL,
    digest text NOT NULL,
    revision integer NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, mutation_id)
);
CREATE INDEX sync_mutations_created_at_idx ON public.sync_mutations USING btree (created_at);

CREATE TABLE public.assets (
    board_id integer NOT NULL,
    asset_id text NOT NULL,
    digest text NOT NULL,
    byte_length integer NOT NULL,
    mime_type text NOT NULL,
    chunk_size integer NOT NULL,
    chunk_count integer NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, asset_id)
);

CREATE TABLE public.asset_chunks (
    board_id integer NOT NULL,
    asset_id text NOT NULL,
    chunk_index integer NOT NULL,
    bytes bytea NOT NULL,
    PRIMARY KEY (board_id, asset_id, chunk_index)
);

CREATE TABLE public.upload_sessions (
    upload_id text PRIMARY KEY,
    board_id integer NOT NULL,
    user_id integer NOT NULL,
    asset_id text NOT NULL,
    digest text NOT NULL,
    byte_length integer NOT NULL,
    mime_type text NOT NULL,
    chunk_size integer NOT NULL,
    chunk_count integer NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX upload_sessions_asset_idx ON public.upload_sessions USING btree (board_id, asset_id);
CREATE INDEX upload_sessions_expires_at_idx ON public.upload_sessions USING btree (expires_at);

CREATE TABLE public.drawing_strokes (
    board_id integer NOT NULL,
    sync_id text NOT NULL,
    seq bigserial NOT NULL,
    color text NOT NULL,
    width double precision NOT NULL,
    points jsonb NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, sync_id)
);
