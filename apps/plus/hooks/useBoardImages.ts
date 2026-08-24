import { ChangeEvent, RefObject, useRef, useState } from "react";

export type BoardImage = {
    imageId: number;
    boardId: number;
    publicId: string;
    secureUrl: string;
    fileName: string | null;
    file?: File;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

type BoardPoint = {
    x: number;
    y: number;
};

type UseBoardImagesOptions = {
    initialImages: BoardImage[];
    boardId: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    canEditCard: boolean;
    showPermissionMessage: () => void;
    setPermissionMessage: (message: string) => void;
    onPreviewUpdate: () => void;
};
// FUNCTION_PAYLOAD_TOO_LARGE를 막기위해 이미지 업로드 전에 클라이언트에서 이미지를 압축하는 함수
async function compressImage(file: File) {
    try {
        const maxFileSize = 4 * 1024 * 1024;
        const image = new Image();
        const imageUrl = URL.createObjectURL(file);

        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = reject;
            image.src = imageUrl;
        });

        const maxSize = 2000;
        const scale = Math.min(
            maxSize / image.width,
            maxSize / image.height,
            1
        );

        const canvas = document.createElement("canvas");
        let width = Math.round(image.width * scale);
        let height = Math.round(image.height * scale);
        let blob: Blob;

        do {
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                throw new Error("Canvas context is not available.");
            }

            ctx.drawImage(image, 0, 0, width, height);
            blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (result) => {
                        if (!result) reject(new Error("Image compression failed."));
                        else resolve(result);
                    },
                    "image/png"
                );
            });

            if (blob.size > maxFileSize) {
                width = Math.max(1, Math.round(width * 0.85));
                height = Math.max(1, Math.round(height * 0.85));
            }
        } while (blob.size > maxFileSize);

        URL.revokeObjectURL(imageUrl);

        return new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".png"),
            { type: "image/png" }
        );
    }   catch (error) { 
        console.error("Error compressing image:", error);
        return file;
    }
}

export function useBoardImages({
    initialImages,
    boardId,
    boardZoom,
    cardLocationRef,
    canEditCard,
    showPermissionMessage,
    setPermissionMessage,
    onPreviewUpdate,
}: UseBoardImagesOptions) {
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const [images, setImages] = useState(initialImages);
    const [editingImageId, setEditingImageId] = useState<number | null>(null);

    const handleImageUploadClick = () => {
        if (!canEditCard) {
            showPermissionMessage();
            return;
        }
        imageInputRef.current?.click();
    };

    const getImageDisplaySize = (file: File) =>
        new Promise<{ width: number; height: number }>((resolve) => {
            const imageUrl = URL.createObjectURL(file);
            const image = document.createElement("img");

            image.onload = () => {
                const maxWidth = 400;
                const maxHeight = 300;
                const scale = Math.min(
                    maxWidth / image.naturalWidth,
                    maxHeight / image.naturalHeight,
                    1
                );

                URL.revokeObjectURL(imageUrl);
                resolve({
                    width: Math.round(image.naturalWidth * scale),
                    height: Math.round(image.naturalHeight * scale),
                });
            };

            image.onerror = () => {
                URL.revokeObjectURL(imageUrl);
                resolve({ width: 400, height: 300 });
            };

            image.src = imageUrl;
        });

    const getImageAutoLocation = (): BoardPoint => {
        const locationElement = cardLocationRef.current;
        if (!locationElement) {
            return { x: 0, y: 0 };
        }

        return {
            x: Math.max(0, (locationElement.scrollLeft + locationElement.clientWidth / 2) / boardZoom - 200),
            y: Math.max(0, (locationElement.scrollTop + locationElement.clientHeight / 2) / boardZoom - 150),
        };
    };

    const handleUploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }
        if (!canEditCard) {
            showPermissionMessage();
            return;
        }
        const compressedFile = await compressImage(file);
        const { x, y } = getImageAutoLocation();
        const { width, height } = await getImageDisplaySize(compressedFile);
        const tempImageUrl = URL.createObjectURL(compressedFile);
        const tempImage: BoardImage = {
            imageId: -Date.now(),
            boardId,
            publicId: "",
            secureUrl: tempImageUrl,
            fileName: compressedFile.name,
            file: compressedFile,
            x: Math.round(x),
            y: Math.round(y),
            z: 1,
            width,
            height,
        };

        setImages((prev) => [...prev, tempImage]);
        setEditingImageId(tempImage.imageId);
    };

    const handleInsertImage = async (tempId: number, file: File, boardId: number, x: number, y: number, z: number, width: number, height: number) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("boardId", String(boardId));
        formData.append("x", String(x));
        formData.append("y", String(y));
        formData.append("z", String(z));
        formData.append("width", String(width));
        formData.append("height", String(height));

        const response = await fetch("/api/images", {
            method: "POST",
            body: formData,
        });
        const data = await response.json();

        if (!data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to upload images.");
            return;
        }

        const tempImage = images.find((image) => image.imageId === tempId);
        if (tempImage?.secureUrl) {
            URL.revokeObjectURL(tempImage.secureUrl);
        }

        setImages((prev) =>
            prev.map((image) =>
                image.imageId === tempId ? data.image : image
            )
        );
        setEditingImageId(data.image.imageId);
        onPreviewUpdate();
    };

    const handleUpdateImage = async (imageId: number, boardId: number, publicId: string, secureUrl: string, fileName: string | null, x: number, y: number, z: number, width: number, height: number) => {
        const response = await fetch(`/api/images/${imageId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ boardId, publicId, secureUrl, fileName, x, y, z, width, height }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to edit images.");
            return;
        }

        setImages((prev) =>
            prev.map((image) =>
                image.imageId === imageId ? { ...image, boardId, publicId, secureUrl, fileName, x, y, z, width, height } : image
            )
        );
        onPreviewUpdate();
    };

    const handleDeleteImage = async (imageId: number) => {
        if (imageId < 0) {
            const tempImage = images.find((image) => image.imageId === imageId);
            if (tempImage?.secureUrl) {
                URL.revokeObjectURL(tempImage.secureUrl);
            }

            setImages((prev) => prev.filter((image) => image.imageId !== imageId));
            setEditingImageId(null);
            return;
        }

        const response = await fetch(`/api/images/${imageId}`, {
            method: "DELETE",
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to delete images.");
            return;
        }

        setImages((prev) => prev.filter((image) => image.imageId !== imageId));
        setEditingImageId(null);
    };

    return {
        imageInputRef,
        images,
        setImages,
        editingImageId,
        setEditingImageId,
        handleImageUploadClick,
        handleUploadImage,
        handleInsertImage,
        handleUpdateImage,
        handleDeleteImage,
    };
}
