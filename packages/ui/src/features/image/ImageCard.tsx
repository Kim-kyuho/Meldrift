"use client";

import type {
    MouseEventHandler,
    PointerEventHandler,
    ReactNode,
} from "react";
import {
    Rnd,
    type RndDragCallback,
    type RndResizeCallback,
} from "react-rnd";
import { ACTIVE_CARD_Z } from "@meldrift/core/cards";
import ConfirmDialog from "../../shared/ConfirmDialog";
import ImageToolBar from "./ImageToolBar";

type ImageCardState = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type ImageCardViewProps = {
    imageId: number;
    z: number;
    zoom: number;
    isEditing: boolean;
    imageState: ImageCardState;
    deleteDialogOpen: boolean;
    onPress: MouseEventHandler<HTMLDivElement>;
    onEdit: () => void;
    onDoubleTap: PointerEventHandler<HTMLDivElement>;
    onDragStop: RndDragCallback;
    onResizeStop: RndResizeCallback;
    onBringToFront: () => void;
    onSendToBack: () => void;
    onOpenDeleteDialog: () => void;
    onConfirmDelete: () => void;
    onCloseDeleteDialog: () => void;
    children: ReactNode;
};

export default function ImageCardView({
    imageId,
    z,
    zoom,
    isEditing,
    imageState,
    deleteDialogOpen,
    onPress,
    onEdit,
    onDoubleTap,
    onDragStop,
    onResizeStop,
    onBringToFront,
    onSendToBack,
    onOpenDeleteDialog,
    onConfirmDelete,
    onCloseDeleteDialog,
    children,
}: ImageCardViewProps) {
    return (
        <>
            <Rnd
                data-editing={isEditing}
                className={`image-rnd-${imageId} select-none ${isEditing ? "card-editing" : ""}`}
                style={{
                    zIndex: isEditing ? ACTIVE_CARD_Z : z,
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                }}
                default={{
                    x: imageState.x,
                    y: imageState.y,
                    width: imageState.width,
                    height: imageState.height,
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
                onDragStop={onDragStop}
                onResizeStop={onResizeStop}
            >
                <div
                    className="relative h-full w-full rounded-xl"
                    onClick={onPress}
                    onDoubleClick={onEdit}
                    onPointerDown={onDoubleTap}
                >
                    <div className="relative h-full w-full overflow-hidden rounded-xl">
                        {children}
                    </div>
                </div>
            </Rnd>

            {isEditing && (
                <ImageToolBar
                    onBringToFront={onBringToFront}
                    onSendToBack={onSendToBack}
                    onDelete={onOpenDeleteDialog}
                />
            )}

            {deleteDialogOpen && (
                <ConfirmDialog
                    message="Delete this image?"
                    onConfirm={onConfirmDelete}
                    onCancel={onCloseDeleteDialog}
                />
            )}
        </>
    );
}
