import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, boolean, timestamp, varchar, check, index, jsonb, customType } from "drizzle-orm/pg-core";
import type { TableSource } from "@meldrift/core/table-card";
import type { BoardStroke } from "@meldrift/core/board-stroke";

const bytea = customType<{ data: Buffer; driverData: Buffer | string }>({
    dataType: () => "bytea",
    toDriver: (value) => value,
    fromDriver: (value) => typeof value === "string" ? Buffer.from(value.replace(/^\\x/, ""), "hex") : value,
});

export const db_boardSnapshots = pgTable("board_snapshots", {
    boardId: integer("board_id").primaryKey(),
    snapshot: bytea("snapshot").notNull(),
    formatVersion: integer("format_version").notNull(),
    revision: integer("revision").notNull(),
    mutationId: text("mutation_id").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const db_editorLeases = pgTable("editor_leases", {
    userId: integer("user_id").primaryKey(),
    sessionHash: text("session_hash").notNull(),
    tabId: text("tab_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
});

export const db_users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    sessionTokenHash: varchar("session_token_hash", { length: 64 }),
    sessionExpiresAt: timestamp("session_expires_at"),
    isApproved: boolean("permission_flg").notNull().default(false),
    role: varchar("role", { length: 20 }).notNull().default("user"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    check("users_role_check", sql`${table.role} IN ('user', 'admin')`),
]);

export const db_boards = pgTable("boards", {
    boardId: serial("board_id").primaryKey(),
    title: text("title").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    ownerId : text("owner_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const db_memos = pgTable("memos", {
    id: serial("id").primaryKey(),
    boardId : integer("board_id").notNull(),
    content: text("content").notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    color: text("color").notNull(),
    // 보드마다 1부터 매긴다.
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
    // 재정렬은 보드 하나의 sort_order 구간만 읽고 쓴다.
    index("memos_board_id_sort_order_idx").on(table.boardId, table.sortOrder),
]);

export const db_images = pgTable("images", {
    imageId: serial("image_id").primaryKey(),
    boardId: integer("board_id").notNull(),
    publicId: text("public_id").notNull().unique(),
    secureUrl: text("secure_url").notNull(),
    fileName: text("filename"),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull().default(300),
    height: integer("height").notNull().default(200),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const db_mermaids = pgTable("mermaids", {
    mermaidId: serial("mermaid_id").primaryKey(),
    boardId: integer("board_id").notNull(),
    source: text("source").notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const db_drawings = pgTable("drawings", {
    drawingId: serial("drawing_id").primaryKey(),
    boardId: integer("board_id").notNull().unique(),
    source: jsonb("source").$type<BoardStroke[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const db_tables = pgTable("tables", {
    tableId: serial("table_id").primaryKey(),
    boardId: integer("board_id").notNull(),
    source: jsonb("source").$type<TableSource>().notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
