import { and, asc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { db_boardMembers, db_users } from "@/lib/db/schema";
import { managerFromRequest, managerSessionGuard } from "@/lib/editor-guard";

type Context = { params: Promise<{ boardId: string }> };
export const maxDuration = 60;

const json = (data: object, status = 200) =>
    NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status: number, message: string) => json({ ok: false, message }, status);

const memberRole = z.enum(["editor", "viewer"]);
const addInput = z.object({ email: z.string().trim().min(3).max(254), role: memberRole }).strict();
const changeInput = z.object({ userId: z.number().int().positive(), role: memberRole }).strict();
const removeInput = z.object({ userId: z.number().int().positive() }).strict();

async function listMembers(boardId: number) {
    return getDb().select({
        userId: db_boardMembers.userId,
        email: db_users.email,
        role: db_boardMembers.role,
        createdAt: db_boardMembers.createdAt,
    }).from(db_boardMembers)
        .innerJoin(db_users, eq(db_users.id, db_boardMembers.userId))
        .where(eq(db_boardMembers.boardId, boardId))
        .orderBy(asc(db_users.email));
}

export async function GET(request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    const gate = await managerFromRequest(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    return json({ ok: true, ownerEmail: gate.board.ownerId, members: await listMembers(boardId) });
}

export async function POST(request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    const gate = await managerFromRequest(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    const parsed = addInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return fail(400, "Enter a member email and role.");
    }
    const { email, role } = parsed.data;
    if (email.toLowerCase() === gate.board.ownerId.toLowerCase()) {
        return fail(400, "The board owner already has full access.");
    }

    const result = await getDb().execute(sql`
        INSERT INTO board_members (board_id, user_id, role, added_by)
        SELECT ${boardId}, u.id, ${role}, ${gate.identity.userId} FROM users u
        WHERE lower(u.email) = lower(${email}) AND ${managerSessionGuard(gate.identity, boardId)}
        ON CONFLICT (board_id, user_id) DO UPDATE SET role = excluded.role
        RETURNING user_id`);
    if (result.rows.length === 0) {
        return fail(404, "No member uses that email, or your permissions changed.");
    }
    console.info("board.member_added", { actor: gate.identity.userId, boardId, role });
    return json({ ok: true, members: await listMembers(boardId) });
}

export async function PATCH(request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    const gate = await managerFromRequest(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    const parsed = changeInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return fail(400, "Choose a member and role.");
    }
    const updated = await getDb().update(db_boardMembers).set({ role: parsed.data.role }).where(and(
        eq(db_boardMembers.boardId, boardId),
        eq(db_boardMembers.userId, parsed.data.userId),
        managerSessionGuard(gate.identity, boardId),
    )).returning({ userId: db_boardMembers.userId });
    if (updated.length === 0) {
        return fail(409, "The member no longer exists or your permissions changed.");
    }
    return json({ ok: true, members: await listMembers(boardId) });
}

export async function DELETE(request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    const gate = await managerFromRequest(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    const parsed = removeInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return fail(400, "Choose a member to remove.");
    }
    const removed = await getDb().delete(db_boardMembers).where(and(
        eq(db_boardMembers.boardId, boardId),
        eq(db_boardMembers.userId, parsed.data.userId),
        managerSessionGuard(gate.identity, boardId),
    )).returning({ userId: db_boardMembers.userId });
    if (removed.length === 0) {
        return fail(409, "The member no longer exists or your permissions changed.");
    }
    console.info("board.member_removed", { actor: gate.identity.userId, boardId });
    return json({ ok: true, members: await listMembers(boardId) });
}
