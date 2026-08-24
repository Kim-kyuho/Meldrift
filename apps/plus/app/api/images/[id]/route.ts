import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_images } from "@/lib/db/schema";
import { v2 as cloudinary } from "cloudinary";
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

        const db = getDb();
        const body = await request.json();
        const updates: Partial<typeof db_images.$inferInsert> = {};
        const imageId = Number((await params).id);
        if (!Number.isInteger(imageId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid image id.",
                },
                { status: 400 },
            );
        }

        if (body.boardId !== undefined) updates.boardId = body.boardId;
        if (body.publicId !== undefined) updates.publicId = body.publicId;
        if (body.secureUrl !== undefined) updates.secureUrl = body.secureUrl;
        if (body.fileName !== undefined) updates.fileName = body.fileName;
        if (body.x !== undefined) updates.x = body.x;
        if (body.y !== undefined) updates.y = body.y;
        if (body.z !== undefined) updates.z = body.z;
        if (body.width !== undefined) updates.width = body.width;
        if (body.height !== undefined) updates.height = body.height;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No update fields were provided.",
                },
                { status: 400 },
            );
        }

        const updatedImage = await db.update(db_images).set(updates).where(eq(db_images.imageId, imageId)).returning();

        if (!updatedImage[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Image does not exist.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
        console.error("Error updating image:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while updating the image.",
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
        if (
            !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Cloudinary environment variables are not set.",
                },
                { status: 500 },
            );
        }

        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const db = getDb();
        const imageId = Number((await params).id);
        if (!Number.isInteger(imageId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid image id.",
                },
                { status: 400 },
            );
        }

        const targetImage = await db.select().from(db_images).where(eq(db_images.imageId, imageId));

        if (targetImage.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Image does not exist.",
                },
                { status: 404 },
            );
        }

        await cloudinary.uploader.destroy(targetImage[0].publicId);

        await db.delete(db_images).where(eq(db_images.imageId, imageId));

        return NextResponse.json(
            {
                ok: true,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error deleting image:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while deleting the image.",
            },
            { status: 500 },
        );
    }
}
