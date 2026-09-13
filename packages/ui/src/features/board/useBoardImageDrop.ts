import { DragEvent, RefObject, useRef, useState } from "react";

export type UseBoardImageDropOptions = {
    boardScrollRef: RefObject<HTMLDivElement | null>;
    boardZoom: number;
    onDropImages: (files: File[], dropCoords?: { x: number; y: number }) => void | Promise<void>;
};

export function useBoardImageDrop({
    boardScrollRef,
    boardZoom,
    onDropImages,
}: UseBoardImageDropOptions) {
    const [isDraggingOverBoard, setIsDraggingOverBoard] = useState(false);
    const dragCounterRef = useRef(0);

    const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        dragCounterRef.current += 1;
        if (e.dataTransfer.types.includes("Files")) {
            setIsDraggingOverBoard(true);
        }
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) {
            setIsDraggingOverBoard(false);
        }
    };

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDraggingOverBoard(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
            file.type.startsWith("image/"),
        );
        if (droppedFiles.length === 0) return;

        const container = boardScrollRef.current;
        let dropCoords: { x: number; y: number } | undefined;
        if (container) {
            const rect = container.getBoundingClientRect();
            const dropX = (container.scrollLeft + (e.clientX - rect.left)) / boardZoom;
            const dropY = (container.scrollTop + (e.clientY - rect.top)) / boardZoom;
            dropCoords = { x: dropX, y: dropY };
        }

        await onDropImages(droppedFiles, dropCoords);
    };

    return {
        isDraggingOverBoard,
        handleDragEnter,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
