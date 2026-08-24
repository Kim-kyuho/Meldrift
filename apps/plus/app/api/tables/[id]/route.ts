import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_tables } from "@/lib/db/schema";
import { tableSourceSchema } from "@/lib/table-card";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);

        if (permissionMessage) {
            return NextResponse.json(
                {
                    ok: false,
                    message: permissionMessage,
                },
                { status: 403 },
            );
        }

        const tableId = Number((await params).id);
        const body = await request.json();
        const updates: Partial<typeof db_tables.$inferInsert> = {};

        if (!Number.isInteger(tableId) || tableId <= 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid table id.",
                },
                { status: 400 },
            );
        }

        if (body.source !== undefined) {
            const parsedSource = tableSourceSchema.safeParse(body.source);
            if (!parsedSource.success) {
                return NextResponse.json(
                    {
                        ok: false,
                        message: "Invalid table source.",
                    },
                    { status: 400 },
                );
            }
            updates.source = parsedSource.data;
        }

        if (body.boardId !== undefined) {
            if (!Number.isInteger(body.boardId) || body.boardId <= 0) {
                return NextResponse.json({ ok: false, message: "Invalid board id." }, { status: 400 });
            }
            updates.boardId = body.boardId;
        }
        if (body.x !== undefined) {
            if (!Number.isInteger(body.x)) {
                return NextResponse.json({ ok: false, message: "Invalid x coordinate." }, { status: 400 });
            }
            updates.x = body.x;
        }
        if (body.y !== undefined) {
            if (!Number.isInteger(body.y)) {
                return NextResponse.json({ ok: false, message: "Invalid y coordinate." }, { status: 400 });
            }
            updates.y = body.y;
        }
        if (body.z !== undefined) {
            if (!Number.isInteger(body.z)) {
                return NextResponse.json({ ok: false, message: "Invalid z index." }, { status: 400 });
            }
            updates.z = body.z;
        }
        if (body.width !== undefined) {
            if (!Number.isInteger(body.width) || body.width <= 0) {
                return NextResponse.json({ ok: false, message: "Invalid table width." }, { status: 400 });
            }
            updates.width = body.width;
        }
        if (body.height !== undefined) {
            if (!Number.isInteger(body.height) || body.height <= 0) {
                return NextResponse.json({ ok: false, message: "Invalid table height." }, { status: 400 });
            }
            updates.height = body.height;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No update fields were provided.",
                },
                { status: 400 },
            );
        }

        const db = getDb();
        const updatedTable = await db.update(db_tables).set(updates).where(eq(db_tables.tableId, tableId)).returning();

        if (!updatedTable[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Table does not exist.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                ok: true,
                table: updatedTable[0],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error updating table:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while updating the table.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);

        if (permissionMessage) {
            return NextResponse.json(
                {
                    ok: false,
                    message: permissionMessage,
                },
                { status: 403 },
            );
        }

        const tableId = Number((await params).id);

        if (!Number.isInteger(tableId) || tableId <= 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid table id.",
                },
                { status: 400 },
            );
        }

        const db = getDb();
        const deletedTable = await db.delete(db_tables).where(eq(db_tables.tableId, tableId)).returning();

        if (!deletedTable[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Table does not exist.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
        console.error("Error deleting table:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while deleting the table.",
            },
            { status: 500 },
        );
    }
}
