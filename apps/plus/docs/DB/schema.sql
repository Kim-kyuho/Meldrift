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
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.memos (
    id serial PRIMARY KEY,
    board_id integer NOT NULL,
    content text NOT NULL,
    x integer NOT NULL DEFAULT 0,
    y integer NOT NULL DEFAULT 0,
    z integer NOT NULL DEFAULT 1,
    width integer NOT NULL,
    height integer NOT NULL,
    color text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.images (
    image_id serial PRIMARY KEY,
    board_id integer NOT NULL,
    public_id text NOT NULL UNIQUE,
    secure_url text NOT NULL,
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
    source jsonb NOT NULL,
    x integer NOT NULL DEFAULT 0,
    y integer NOT NULL DEFAULT 0,
    z integer NOT NULL DEFAULT 1,
    width integer NOT NULL,
    height integer NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);
