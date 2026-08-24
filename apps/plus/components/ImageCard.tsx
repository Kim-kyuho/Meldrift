"use client";

import Image from "next/image";
import { Rnd } from "react-rnd";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ImageCardData, useImageCard } from "@/hooks/useImageCard";
import { ACTIVE_CARD_Z } from "@/lib/zIndex";
import ImageToolBar from "./ImageToolBar";

type ImageCardProps = {
    image: ImageCardData;
    zoom: number;
    canEdit: boolean;
    isEditing: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onPermissionDenied: () => void;
    onInsert: (
        tempId: number,
        file: File,
        boardId: number,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => void;
    onUpdate: (
        imageId: number,
        boardId: number,
        publicId: string,
        secureUrl: string,
        fileName: string | null,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => void;
    onDelete: (
        imageId: number,
        publicId: string,
    ) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
};

// 이미지 카드 컴포넌트
export default function ImageCard(props: ImageCardProps) {
    const {
        image,
        zoom,
        canEdit,
        isEditing,
        onEditing,
        onEditingClear,
        onPermissionDenied,
        onInsert,
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
        canEdit,
        isEditing,
        onEditing,
        onEditingClear,
        onPermissionDenied,
        onInsert,
        onUpdate,
        onDelete,
    });

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
                        <Image
                            src={image.secureUrl}
                            alt={image.fileName ?? "Uploaded image"}
                            fill
                            draggable={false}
                            sizes={`${Math.round(imageState.width)}px`}
                            className="object-contain"
                        />
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
