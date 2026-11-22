import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { BoardPrivacyError } from "@/lib/board-privacy";
import { getDb } from "@/lib/db";
import { db_users } from "@/lib/db/schema";
import { deleteMemberAccounts } from "@/lib/member-deletion";
import { memberCredentials, memberPermissions, registerMember } from "@/lib/member-registration";
import { activeAdministrator, membershipLock, requestSessionHash } from "@/lib/membership-guard";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const json = (data: object, status = 200) =>
    NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status: number, message: string) => json({ ok: false, message }, status);
export const maxDuration = 60;

async function administrator(request: NextRequest) {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
        return { failure: fail(401, "Please sign in first.") };
    }
    if (user.role !== "admin") {
        return { failure: fail(403, "Only administrators can manage members.") };
    }
    const sessionHash = requestSessionHash(request);
    return { failure: null, user, sessionHash, authorized: activeAdministrator(user.id, sessionHash) };
}

const registerInput = memberCredentials.extend(memberPermissions.shape);
const editInput = memberPermissions.extend({ id: z.number().int().positive() });
const deleteInput = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) });
const unavailableMember = () => fail(409, "A selected member no longer exists or your permissions changed.");

export async function GET(request: NextRequest) {
    const gate = await administrator(request);
    if (gate.failure) {
        return gate.failure;
    }
    const members = await getDb().select({
        id: db_users.id,
        email: db_users.email,
        isApproved: db_users.isApproved,
        role: db_users.role,
        createdAt: db_users.createdAt,
    }).from(db_users).where(gate.authorized).orderBy(asc(db_users.id));
    return json({ ok: true, members });
}

export async function POST(request: NextRequest) {
    const gate = await administrator(request);
    if (gate.failure) {
        return gate.failure;
    }
    const parsed = registerInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return fail(400, "Enter a valid email, password and permissions.");
    }
    const result = await registerMember(parsed.data, { userId: gate.user.id, sessionHash: gate.sessionHash });
    if (!result.allowed) {
        return fail(403, "Your administrator permission changed.");
    }
    if (result.id === null) {
        return fail(409, "This email is already registered or used by a retained board.");
    }
    console.info("member.created", { actor: gate.user.id, member: result.id });
    return json({ ok: true }, 201);
}

export async function PATCH(request: NextRequest) {
    const gate = await administrator(request);
    if (gate.failure) {
        return gate.failure;
    }
    const parsed = editInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return fail(400, "Invalid member permissions.");
    }
    const { id, role, isApproved } = parsed.data;
    if (id === gate.user.id && role !== "admin") {
        return fail(409, "You cannot remove your own administrator role.");
    }
    const db = getDb();
    const [, updated] = await db.batch([
        db.execute(membershipLock),
        db.update(db_users).set({ role, isApproved, updatedAt: new Date() })
            .where(and(eq(db_users.id, id), gate.authorized)).returning({ id: db_users.id }),
    ]);
    if (!updated.length) {
        return unavailableMember();
    }
    console.info("member.permissions_changed", { actor: gate.user.id, member: id, role, isApproved });
    return json({ ok: true });
}

export async function DELETE(request: NextRequest) {
    const gate = await administrator(request);
    if (gate.failure) {
        return gate.failure;
    }
    const parsed = deleteInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return fail(400, "Select up to 100 valid members.");
    }
    const ids = [...new Set(parsed.data.ids)];
    if (ids.includes(gate.user.id)) {
        return fail(409, "You cannot delete your own account.");
    }

    try {
        const retainedBoards = await deleteMemberAccounts(ids, gate.authorized);
        if (retainedBoards === null) {
            return unavailableMember();
        }
        console.info("member.deleted", { actor: gate.user.id, members: ids, retainedBoards });
        return json({ ok: true, retainedBoards });
    } catch (error) {
        if (error instanceof BoardPrivacyError) {
            return fail(503, error.message);
        }
        console.error("Error deleting members:", error);
        return fail(500, "The selected members could not be deleted.");
    }
}
