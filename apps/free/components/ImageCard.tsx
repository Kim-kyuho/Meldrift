"use client";

import { useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ImageCardData, useImageCard } from "@/hooks/useImageCard";
import { ACTIVE_CARD_Z } from "@/lib/zIndex";
import { imageBytesToBlob } from "@/lib/image-file";
import ImageToolBar from "./ImageToolBar";

type ImageCardProps = {
    image: ImageCardData;
    zoom: number;
    isEditing: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onUpdate: (
        imageId: number,
        boardId: number,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => void;
    onDelete: (imageId: number) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
};

// 이미지 카드 컴포넌트
export default function ImageCard(props: ImageCardProps) {
    const {
        image,
        zoom,
        isEditing,
        onEditing,
        onEditingClear,
        onUpdate,
        onDelete,
        onBringToFront,
        onSendToBack,
    } = props;

    const {
        imageState,
        deleteDialogOpen,
        editImage,
        handleDoubleTap,
        handleImagePress,
        handleDragStop,
        handleResizeStop,
        openDeleteDialog,
        confirmDelete,
        closeDeleteDialog,
    } = useImageCard({
        image,
        isEditing,
        onEditing,
        onEditingClear,
        onUpdate,
        onDelete,
    });
    const imageElementRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const imageElement = imageElementRef.current;
        if (!imageElement || !image.data || !image.mimeType) return;

        const objectUrl = URL.createObjectURL(imageBytesToBlob(image.data, image.mimeType));
        imageElement.src = objectUrl;
        return () => URL.revokeObjectURL(objectUrl);
    }, [image.data, image.mimeType]);

    return (
        <>
            <Rnd
                data-editing={isEditing}
                className={`image-rnd-${image.imageId} select-none ${isEditing ? "card-editing" : ""}`}
                style={{
                    zIndex: isEditing ? ACTIVE_CARD_Z : image.z,
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                }}
                default={{
                    x: image.x,
                    y: image.y,
                    width: image.width,
                    height: image.height,
                }}
                position={{
                    x: imageState.x,
                    y: imageState.y,
                }}
                size={{
                    width: imageState.width,
                    height: imageState.height,
                }}
                bounds="parent"
                scale={zoom}
                minWidth={48}
                minHeight={48}
                disableDragging={!isEditing}
                enableResizing={isEditing}
                onDragStop={handleDragStop}
                onResizeStop={handleResizeStop}
            >
                <div
                    className="relative h-full w-full rounded-xl"
                    onClick={handleImagePress}
                    onDoubleClick={editImage}
                    onPointerDown={handleDoubleTap}
                >
                    <div className="relative h-full w-full overflow-hidden rounded-xl">
                        {(image.data || image.url) && (
                            // Blob URLs and legacy arbitrary URLs cannot use the Next image optimizer.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                ref={imageElementRef}
                                src={image.data ? undefined : image.url}
                                alt={image.label ?? "Board image"}
                                draggable={false}
                                className="h-full w-full object-contain"
                            />
                        )}
                    </div>
                </div>
            </Rnd>

            {isEditing && (
                <ImageToolBar
                    onBringToFront={onBringToFront}
                    onSendToBack={onSendToBack}
                    onDelete={openDeleteDialog}
                />
            )}

            {deleteDialogOpen && (
                <ConfirmDialog
                    message="Delete this image?"
                    onConfirm={confirmDelete}
                    onCancel={closeDeleteDialog}
                />
            )}
        </>
    );
}
