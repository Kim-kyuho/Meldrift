import { memberCredentials, registerMember } from "@/lib/member-registration";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const parsed = memberCredentials.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 400 });
        }
        const user = { email: parsed.data.email, isApproved: false, role: "user" as const };
        const result = await registerMember({ ...parsed.data, ...user });
        if (result.id === null) {
            return NextResponse.json({ ok: false, message: "This email is unavailable." }, { status: 409 });
        }
        return NextResponse.json({ ok: true, user }, { status: 201 });
    } catch (error) {
        console.error("Error during sign up:", error);
        return NextResponse.json({ ok: false, message: "An error occurred during sign up." }, { status: 500 });
    }
}
