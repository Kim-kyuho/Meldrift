import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_boards } from "@/lib/db/schema";
import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const maxPreviewSize = 4 * 1024 * 1024;
const previewImageTypes = new Set(["image/png", "image/webp"]);

export async function PUT(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
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

        const boardId = Number((await params).boardId);

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid board id.",
                },
                { status: 400 },
            );
        }

        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File) || file.size === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Preview image file is required.",
                },
                { status: 400 },
            );
        }

        if (!previewImageTypes.has(file.type)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Preview image must be a PNG or WebP file.",
                },
                { status: 400 },
            );
        }

        if (file.size > maxPreviewSize) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Preview image must be 4 MB or smaller.",
                },
                { status: 413 },
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

        const db = getDb();
        const targetBoard = await db
            .select({ boardId: db_boards.boardId })
            .from(db_boards)
            .where(eq(db_boards.boardId, boardId))
            .limit(1);

        if (!targetBoard[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "This board does not exist.",
                },
                { status: 404 },
            );
        }

        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `kyuboard/boards/${boardId}`,
                    public_id: "PreviewIMG",
                    format: "webp",
                    overwrite: true,
                    invalidate: true,
                },
                (error, result) => {
                    if (error || !result) {
                        reject(error ?? new Error("Cloudinary preview upload failed"));
                        return;
                    }

                    resolve(result);
                },
            );

            uploadStream.end(buffer);
        });

        return NextResponse.json(
            {
                ok: true,
                preview: {
                    publicId: uploadResult.public_id,
                    secureUrl: uploadResult.secure_url,
                    width: uploadResult.width,
                    height: uploadResult.height,
                    bytes: uploadResult.bytes,
                    format: uploadResult.format,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error uploading board preview:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while uploading the board preview.",
            },
            { status: 500 },
        );
    }
}
