import {
    MouseEvent as ReactMouseEvent,
    PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { DraggableData, RndDragEvent, RndResizeCallback } from "react-rnd";

export interface ImageCardData {
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
}

type UseImageCardOptions = {
    image: ImageCardData;
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
};

export function useImageCard({
    image,
    canEdit,
    isEditing,
    onEditing,
    onEditingClear,
    onPermissionDenied,
    onInsert,
    onUpdate,
    onDelete,
}: UseImageCardOptions) {
    const [imageState, setImageState] = useState({
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
    });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const lastImageTapRef = useRef(0);
    const imageStateRef = useRef(imageState);
    
    const saveImageDraft = useCallback(() => {
        if (image.imageId < 0) {
            if (!image.file) {
                return;
            }

            const latestImageState = imageStateRef.current;

            onInsert(
                image.imageId,
                image.file,
                image.boardId,
                Math.round(latestImageState.x),
                Math.round(latestImageState.y),
                image.z,
                Math.round(latestImageState.width),
                Math.round(latestImageState.height),
            );
            return;
        }

        const latestImageState = imageStateRef.current;

        onUpdate(
            image.imageId,
            image.boardId,
            image.publicId,
            image.secureUrl,
            image.fileName,
            Math.round(latestImageState.x),
            Math.round(latestImageState.y),
            image.z,
            Math.round(latestImageState.width),
            Math.round(latestImageState.height),
        );
    }, [
        image.boardId,
        image.file,
        image.fileName,
        image.imageId,
        image.publicId,
        image.secureUrl,
        image.z,
        onInsert,
        onUpdate,
    ]);

    const editImage = () => {
        if (!canEdit) {
            onPermissionDenied();
            return;
        }

        onEditing();
    };

    const handleDoubleTap = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "touch") {
            return;
        }

        const currentTime = event.timeStamp;
        const isDoubleTap = currentTime - lastImageTapRef.current < 300;
        lastImageTapRef.current = currentTime;

        if (isDoubleTap) {
            // event.preventDefault();
            editImage();
        }
    };

    useEffect(() => {
        const handlePressOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            const targetElement = target instanceof Element ? target : null;

            const isPressInsideBoardToolBar = targetElement?.closest(".board-toolbar");
            const isPressInsideImage = targetElement?.closest(`.image-rnd-${image.imageId}`);
            const isPressInsideBoard = targetElement?.closest(".board-scroll-layer");
            const isPressInsideEmptyBoard = Boolean(
                isPressInsideBoard &&
                !isPressInsideImage &&
                !isPressInsideBoardToolBar
            );

            if (isEditing && isPressInsideEmptyBoard) {
                window.setTimeout(() => {
                    saveImageDraft();
                    onEditingClear();
                }, 0);
                return;
            }
        };

        document.addEventListener("pointerup", handlePressOutside);

        return () => {
            document.removeEventListener("pointerup", handlePressOutside);
        };
    }, [image.imageId, isEditing, onEditingClear, saveImageDraft]);

    const handleImagePress = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const handleDragStop = (_event: RndDragEvent, data: DraggableData) => {
        const nextImageState = { ...imageStateRef.current, x: data.x, y: data.y };
        imageStateRef.current = nextImageState;
        setImageState(nextImageState);
    };

    const handleResizeStop: RndResizeCallback = (_event, _direction, ref, _delta, position) => {
        const nextImageState = {
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
        };
        imageStateRef.current = nextImageState;
        setImageState(nextImageState);
    };

    const openDeleteDialog = () => {
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        onDelete(image.imageId, image.publicId);
        setDeleteDialogOpen(false);
        onEditingClear();
    };

    const closeDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    return {
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
    };
}
