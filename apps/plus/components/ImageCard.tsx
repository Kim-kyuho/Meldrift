"use client";

import Image from "next/image";
import ImageCardView from "@meldrift/ui/ImageCard";
import { ImageCardData, useImageCard } from "@/hooks/useImageCard";

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
    onDelete: (imageId: number, publicId: string) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
};

export default function ImageCard({
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
}: ImageCardProps) {
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
        <ImageCardView
            imageId={image.imageId}
            z={image.z}
            zoom={zoom}
            isEditing={isEditing}
            imageState={imageState}
            deleteDialogOpen={deleteDialogOpen}
            onPress={handleImagePress}
            onEdit={editImage}
            onDoubleTap={handleDoubleTap}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            onBringToFront={onBringToFront}
            onSendToBack={onSendToBack}
            onOpenDeleteDialog={openDeleteDialog}
            onConfirmDelete={confirmDelete}
            onCloseDeleteDialog={closeDeleteDialog}
        >
            <Image
                src={image.secureUrl}
                alt={image.fileName ?? "Uploaded image"}
                fill
                draggable={false}
                sizes={`${Math.round(imageState.width)}px`}
                className="object-contain"
            />
        </ImageCardView>
    );
}
