import { ChangeEvent, RefObject, useRef, useState } from "react";
import { nextPositiveId, type BoardImage } from "@/lib/board-state";
import { prepareImageFile } from "@/lib/image-file";

export type { BoardImage } from "@/lib/board-state";

type UseBoardImagesOptions = {
    initialImages: BoardImage[];
    boardId: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    setMessage: (message: string) => void;
};

export function useBoardImages({
    initialImages,
    boardId,
    boardZoom,
    cardLocationRef,
    setMessage,
}: UseBoardImagesOptions) {
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const [images, setImages] = useState(initialImages);
    const [editingImageId, setEditingImageId] = useState<number | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const handleImageUploadClick = () => {
        if (!uploadingImage) imageInputRef.current?.click();
    };

    const handleUploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || uploadingImage) return;

        setUploadingImage(true);
        setMessage("");
        try {
            const prepared = await prepareImageFile(file);
            const locationElement = cardLocationRef.current;
            const x = locationElement
                ? Math.max(
                    0,
                    (locationElement.scrollLeft + locationElement.clientWidth / 2) / boardZoom - prepared.width / 2,
                )
                : 0;
            const y = locationElement
                ? Math.max(
                    0,
                    (locationElement.scrollTop + locationElement.clientHeight / 2) / boardZoom - prepared.height / 2,
                )
                : 0;
            const imageId = nextPositiveId(images.map((image) => image.imageId));
            const image: BoardImage = {
                imageId,
                boardId,
                url: "",
                data: prepared.data,
                mimeType: prepared.mimeType,
                label: prepared.label,
                x: Math.round(x),
                y: Math.round(y),
                z: 1,
                width: prepared.width,
                height: prepared.height,
            };

            setImages((previous) => [...previous, image]);
            setEditingImageId(imageId);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "The image could not be added.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleUpdateImage = async (
        imageId: number,
        boardId: number,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => {
        setImages((previous) => previous.map((image) => image.imageId === imageId
            ? { ...image, boardId, x, y, z, width, height }
            : image));
    };

    const handleDeleteImage = async (imageId: number) => {
        setImages((previous) => previous.filter((image) => image.imageId !== imageId));
        setEditingImageId(null);
    };

    return {
        imageInputRef,
        images,
        setImages,
        editingImageId,
        setEditingImageId,
        uploadingImage,
        handleImageUploadClick,
        handleUploadImage,
        handleUpdateImage,
        handleDeleteImage,
    };
}
