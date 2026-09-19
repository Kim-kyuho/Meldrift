import { sql } from "drizzle-orm";
import { pgTable, serial, bigserial, text, integer, boolean, doublePrecision, timestamp, varchar, check, index, uniqueIndex, primaryKey, jsonb, customType } from "drizzle-orm/pg-core";
import type { TableSource } from "@meldrift/core/table-card";
import type { BoardStroke, StrokePoint } from "@meldrift/core/board-stroke";

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

export const db_boardSync = pgTable("board_sync", {
    boardId: integer("board_id").primaryKey(),
    revision: integer("revision").notNull().default(0),
    formatVersion: integer("format_version").notNull().default(1),
    mode: varchar("mode", { length: 16 }).notNull().default("snapshot"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    check("board_sync_mode_check", sql`${table.mode} IN ('snapshot', 'migrating', 'delta')`),
]);

export const db_syncMutations = pgTable("sync_mutations", {
    boardId: integer("board_id").notNull(),
    mutationId: text("mutation_id").notNull(),
    digest: text("digest").notNull(),
    revision: integer("revision").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    primaryKey({ columns: [table.boardId, table.mutationId] }),
    index("sync_mutations_created_at_idx").on(table.createdAt),
]);

export const db_assets = pgTable("assets", {
    boardId: integer("board_id").notNull(),
    assetId: text("asset_id").notNull(),
    digest: text("digest").notNull(),
    byteLength: integer("byte_length").notNull(),
    mimeType: text("mime_type").notNull(),
    chunkSize: integer("chunk_size").notNull(),
    chunkCount: integer("chunk_count").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.boardId, table.assetId] })]);

export const db_assetChunks = pgTable("asset_chunks", {
    boardId: integer("board_id").notNull(),
    assetId: text("asset_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    bytes: bytea("bytes").notNull(),
}, (table) => [primaryKey({ columns: [table.boardId, table.assetId, table.chunkIndex] })]);

export const db_uploadSessions = pgTable("upload_sessions", {
    uploadId: text("upload_id").primaryKey(),
    boardId: integer("board_id").notNull(),
    userId: integer("user_id").notNull(),
    assetId: text("asset_id").notNull(),
    digest: text("digest").notNull(),
    byteLength: integer("byte_length").notNull(),
    mimeType: text("mime_type").notNull(),
    chunkSize: integer("chunk_size").notNull(),
    chunkCount: integer("chunk_count").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    uniqueIndex("upload_sessions_asset_idx").on(table.boardId, table.assetId),
    index("upload_sessions_expires_at_idx").on(table.expiresAt),
]);

export const db_drawingStrokes = pgTable("drawing_strokes", {
    boardId: integer("board_id").notNull(),
    syncId: text("sync_id").notNull(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    color: text("color").notNull(),
    width: doublePrecision("width").notNull(),
    points: jsonb("points").$type<StrokePoint[]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.boardId, table.syncId] })]);

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
    syncId: text("sync_id").notNull(),
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
    uniqueIndex("memos_sync_id_idx").on(table.boardId, table.syncId),
]);

export const db_images = pgTable("images", {
    imageId: serial("image_id").primaryKey(),
    boardId: integer("board_id").notNull(),
    syncId: text("sync_id").notNull(),
    assetId: text("asset_id"),
    publicId: text("public_id").unique(),
    secureUrl: text("secure_url"),
    fileName: text("filename"),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull().default(300),
    height: integer("height").notNull().default(200),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    uniqueIndex("images_sync_id_idx").on(table.boardId, table.syncId),
]);

export const db_mermaids = pgTable("mermaids", {
    mermaidId: serial("mermaid_id").primaryKey(),
    boardId: integer("board_id").notNull(),
    syncId: text("sync_id").notNull(),
    source: text("source").notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    uniqueIndex("mermaids_sync_id_idx").on(table.boardId, table.syncId),
]);

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
    syncId: text("sync_id").notNull(),
    source: jsonb("source").$type<TableSource>().notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    z: integer("z").notNull().default(1),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    uniqueIndex("tables_sync_id_idx").on(table.boardId, table.syncId),
]);
