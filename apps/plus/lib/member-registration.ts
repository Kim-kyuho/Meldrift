import { sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db";
import { activeAdministrator, emailIsAvailable, membershipLock } from "@/lib/membership-guard";

export const memberCredentials = z.object({
    email: z.string().trim().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    password: z.string().min(10).max(256).regex(/[A-Za-z]/).regex(/[0-9]/),
});

export const memberPermissions = z.object({
    isApproved: z.boolean(),
    role: z.enum(["user", "admin"]),
});

type Registration = z.infer<typeof memberCredentials> & z.infer<typeof memberPermissions>;

export async function registerMember(input: Registration, admin?: { userId: number; sessionHash: string | null }) {
    const { email, password, isApproved, role } = input;
    const passwordHash = await hashPassword(password);
    const allowed = admin ? activeAdministrator(admin.userId, admin.sessionHash) : sql`true`;
    const db = getDb();
    const [, result] = await db.batch([db.execute(membershipLock), db.execute(sql`
        WITH authorized AS (SELECT ${allowed} AS allowed), created AS (
            INSERT INTO users (email, password_hash, permission_flg, role)
            SELECT ${email}, ${passwordHash}, ${isApproved}, ${role} FROM authorized
            WHERE allowed AND ${emailIsAvailable(email)}
            ON CONFLICT (email) DO NOTHING
            RETURNING id
        )
        SELECT authorized.allowed, created.id FROM authorized LEFT JOIN created ON true
    `)]);
    const resultRow = result.rows[0];
    return { allowed: resultRow?.allowed === true, id: typeof resultRow?.id === "number" ? resultRow.id : null };
}
