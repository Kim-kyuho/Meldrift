import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_images } from "@/lib/db/schema";
import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Image file is required.",
                },
                { status: 400 },
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const boardId = Number(formData.get("boardId"));
        const x = Number(formData.get("x"));
        const y = Number(formData.get("y"));
        const z = Number(formData.get("z"));
        const requestedWidth = Number(formData.get("width"));
        const requestedHeight = Number(formData.get("height"));
        if (
            bytes.byteLength === 0 ||
            !Number.isInteger(boardId) ||
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(z) ||
            boardId <= 0
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid form data.",
                },
                { status: 400 },
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

        const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `kyuboard/boards/${boardId}`,
                },
                (error, result) => {
                    if (error || !result) {
                        reject(error ?? new Error("Cloudinary upload failed"));
                        return;
                    }

                    resolve(result);
                },
            );

            uploadStream.end(buffer);
        });

        const maxWidth = 400;
        const maxHeight = 300;
        const scale = Math.min(maxWidth / uploadResult.width, maxHeight / uploadResult.height, 1);
        const width = Math.round(uploadResult.width * scale);
        const height = Math.round(uploadResult.height * scale);

        const db = getDb();

        const newImage = await db
            .insert(db_images)
            .values({
                boardId: boardId,
                publicId: uploadResult.public_id,
                secureUrl: uploadResult.secure_url,
                fileName: file.name,
                x: x,
                y: y,
                z: z,
                width: Number.isFinite(requestedWidth) && requestedWidth > 0 ? requestedWidth : width,
                height: Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : height,
            })
            .returning();

        return NextResponse.json(
            {
                ok: true,
                image: newImage[0],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error uploading image:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while uploading the image.",
            },
            { status: 500 },
        );
    }
}
