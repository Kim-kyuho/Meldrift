import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, boolean, timestamp, varchar, check, jsonb } from "drizzle-orm/pg-core";
import type { TableSource } from "@/lib/table-card";
import type { BoardStroke } from "@/lib/board-stroke";

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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

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
