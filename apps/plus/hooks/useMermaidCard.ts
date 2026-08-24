import { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { DraggableData, RndDragEvent, RndResizeCallback } from "react-rnd";

export type MermaidCardData = {
    id: number;
    boardId: number;
    source: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

type UseMermaidCardOptions = {
    mermaid: MermaidCardData;
    canEdit: boolean;
    isEditing: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onPermissionDenied: () => void;
    onUpdate: (
        id: number,
        boardId: number,
        source: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => void;
    onInsert: (
        tempId: number,
        boardId: number,
        source: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => void;
    onDelete: (id: number) => void;
};

export function useMermaidCard({
    mermaid,
    canEdit,
    isEditing,
    onEditing,
    onEditingClear,
    onPermissionDenied,
    onInsert,
    onUpdate,
    onDelete,
}: UseMermaidCardOptions) {
    const [source, setSource] = useState(mermaid.source);
    const [cardState, setCardState] = useState({
        x: mermaid.x,
        y: mermaid.y,
        width: mermaid.width,
        height: mermaid.height,
    });
    const [dragHandlePressed, setDragHandlePressed] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const lastMermaidTapRef = useRef(0);
    const sourceRef = useRef(source);
    const cardStateRef = useRef(cardState);
    // 카드 내부에서 드래그하여 카드 외부에서 Pointer up이벤트가 발상한 경우 내용 저장을 방지하기 위한 Ref
    const outsidePressStartedRef = useRef(false);

    useEffect(() => {
        sourceRef.current = source;
    }, [source]);

    useEffect(() => {
        cardStateRef.current = cardState;
    }, [cardState]);

    const insertMermaid = useCallback(() => {
        const latestCardState = cardStateRef.current;

        onInsert(
            mermaid.id,
            mermaid.boardId,
            sourceRef.current,
            Math.round(latestCardState.x),
            Math.round(latestCardState.y),
            mermaid.z,
            Math.round(latestCardState.width),
            Math.round(latestCardState.height),
        );
    }, [mermaid.boardId, mermaid.id, mermaid.z, onInsert]);

    const updateMermaid = useCallback(() => {
        const latestCardState = cardStateRef.current;

        onUpdate(
            mermaid.id,
            mermaid.boardId,
            sourceRef.current,
            Math.round(latestCardState.x),
            Math.round(latestCardState.y),
            mermaid.z,
            Math.round(latestCardState.width),
            Math.round(latestCardState.height),
        );
    }, [mermaid.boardId, mermaid.id, mermaid.z, onUpdate]);

    const saveMermaidDraft = useCallback(() => {
        if (mermaid.id < 0) {
            insertMermaid();
            return;
        }

        updateMermaid();
    }, [insertMermaid, mermaid.id, updateMermaid]);

    const editMermaid = () => {
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
        const isDoubleTap = currentTime - lastMermaidTapRef.current < 300;
        lastMermaidTapRef.current = currentTime;

        if (isDoubleTap) {
            editMermaid();
        }
    };

    useEffect(() => {
        const handlePressStart = (event: PointerEvent) => {
            const target = event.target as Node;
            const targetElement = target instanceof Element ? target : null;
            const isPressInsideCard = targetElement?.closest(`.mermaid-rnd-${mermaid.id}`);
            const isPressInsideBoardToolBar = targetElement?.closest(".board-toolbar");
            const isPressInsideBoard = targetElement?.closest(".board-scroll-layer");

            outsidePressStartedRef.current = Boolean(
                isPressInsideBoard &&
                !isPressInsideCard &&
                !isPressInsideBoardToolBar
            );
        };

        const handlePressOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            const targetElement = target instanceof Element ? target : null;
            const isPressInsideCard = targetElement?.closest(`.mermaid-rnd-${mermaid.id}`);
            const isPressInsideBoardToolBar = targetElement?.closest(".board-toolbar");
            const isPressInsideBoard = targetElement?.closest(".board-scroll-layer");
            const isPressInsideEmptyBoard = Boolean(
                isPressInsideBoard &&
                !isPressInsideCard &&
                !isPressInsideBoardToolBar
            );

            const startedInsideEmptyBoard = outsidePressStartedRef.current;
            outsidePressStartedRef.current = false;

            if (isEditing && startedInsideEmptyBoard && isPressInsideEmptyBoard) {
                saveMermaidDraft();
                onEditingClear();
            }
        };

        document.addEventListener("pointerdown", handlePressStart);
        document.addEventListener("pointerup", handlePressOutside);

        return () => {
            document.removeEventListener("pointerdown", handlePressStart);
            document.removeEventListener("pointerup", handlePressOutside);
        };
    }, [isEditing, saveMermaidDraft, mermaid.id, onEditingClear]);

    const handleMermaidPress = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const handleDragStop = (_event: RndDragEvent, data: DraggableData) => {
        const nextCardState = { ...cardStateRef.current, x: data.x, y: data.y };
        cardStateRef.current = nextCardState;
        setCardState(nextCardState);
    };

    const handleResizeStop: RndResizeCallback = (_event, _direction, ref, _delta, position) => {
        const nextCardState = {
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
        };

        cardStateRef.current = nextCardState;
        setCardState(nextCardState);
    };

    const openDeleteDialog = () => {
        setDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    const confirmDelete = () => {
        onDelete(mermaid.id);
        onEditingClear();
        setDeleteDialogOpen(false);
    };

    return {
        cardState,
        source,
        setSource,
        isEditing,
        deleteDialogOpen,
        dragHandlePressed,
        setDragHandlePressed,
        editMermaid,
        handleDoubleTap,
        handleMermaidPress,
        handleDragStop,
        handleResizeStop,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDelete,
    };
}
