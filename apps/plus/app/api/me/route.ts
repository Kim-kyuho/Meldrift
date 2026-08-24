import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);

        if (!currentUser) {
            return NextResponse.json(
                {
                    user: null,
                },
                { status: 200 },
            );
        }

        return NextResponse.json(
            {
                user: {
                    email: currentUser.email,
                    isApproved: currentUser.isApproved,
                    role: currentUser.role,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error fetching current user:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while fetching the current user.",
            },
            { status: 500 },
        );
    }
}
