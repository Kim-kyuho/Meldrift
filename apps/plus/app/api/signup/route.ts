import { getDb } from "@/lib/db";
import { db_users } from "@/lib/db/schema";
import { randomBytes, scrypt } from "crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
}

export async function POST(request: NextRequest) {
    try {
        const db = getDb();
        const body = await request.json();
        const email = String(body.email ?? "").trim();
        const password = String(body.password ?? "");

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid email",
                },
                { status: 400 },
            );
        }

        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid password",
                },
                { status: 400 },
            );
        }

        const existingUser = await db
            .select({ id: db_users.id })
            .from(db_users)
            .where(eq(db_users.email, email))
            .limit(1);

        if (existingUser.length > 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Email already exists",
                },
                { status: 409 },
            );
        }

        const passwordHash = await hashPassword(password);

        const newUser = await db
            .insert(db_users)
            .values({
                email,
                passwordHash,
                isApproved: false,
                role: "user",
            })
            .returning();

        return NextResponse.json(
            {
                ok: true,
                user: {
                    email: newUser[0].email,
                    isApproved: newUser[0].isApproved,
                    role: newUser[0].role,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Error during sign up:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred during sign up",
            },
            { status: 500 },
        );
    }
}
