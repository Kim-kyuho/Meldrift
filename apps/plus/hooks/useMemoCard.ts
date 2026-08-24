import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { DraggableData, RndDragEvent, RndResizeCallback } from "react-rnd";

export interface MemoCardData {
    id: number;
    boardId: number;
    content: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    color: string;
}

type UseMemoCardOptions = {
    memo: MemoCardData;
    canEdit: boolean;
    isEditing: boolean;
    isFocused: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onFocus: () => void;
    onFocusClear: () => void;
    onPermissionDenied: () => void;
    onInsert: (
        tempId: number,
        boardId: number,
        content: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        color: string
    ) => void;
    onUpdate: (
        id: number,
        boardId: number,
        content: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        color: string
    ) => void;
    onDelete: (id: number) => void;
};

export function useMemoCard({
    memo,
    canEdit,
    isEditing,
    isFocused,
    onEditing,
    onEditingClear,
    onFocus,
    onFocusClear,
    onPermissionDenied,
    onInsert,
    onUpdate,
    onDelete,
}: UseMemoCardOptions) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [dragHandlePressed, setDragHandlePressed] = useState(false);
    const memoFocusRef = useRef<HTMLDivElement | null>(null);
    const lastMemoTapRef = useRef(0);
    // 카드 내부에서 드래그하여 카드 외부에서 Pointer up이벤트가 발상한 경우 내용 저장을 방지하기 위한 Ref
    const outsidePressStartedRef = useRef(false);

    const [memoState, setMemoState] = useState({
        x: memo.x,
        y: memo.y,
        width: memo.width ?? 300,
        height: memo.height ?? 200,
    });

    const [memoContent, setMemoContent] = useState(memo.content);
    const [memoColor, setMemoColor] = useState(memo.color);

    const insertMemo = useCallback(() => {
        onInsert(
            memo.id,
            memo.boardId,
            memoContent,
            Math.round(memoState.x),
            Math.round(memoState.y),
            memo.z,
            Math.round(memoState.width),
            Math.round(memoState.height),
            memoColor
        );
    }, [
        memo.id,
        memo.boardId,
        memoContent,
        memoState.x,
        memoState.y,
        memo.z,
        memoState.width,
        memoState.height,
        memoColor,
        onInsert,
    ]);

    const updateMemo = useCallback(() => {
        onUpdate(
            memo.id,
            memo.boardId,
            memoContent,
            Math.round(memoState.x),
            Math.round(memoState.y),
            memo.z,
            Math.round(memoState.width),
            Math.round(memoState.height),
            memoColor
        );
    }, [
        memo.id,
        memo.boardId,
        memoContent,
        memoState.x,
        memoState.y,
        memo.z,
        memoState.width,
        memoState.height,
        memoColor,
        onUpdate,
    ]);

    const saveMemo = useCallback(() => {
        if (memo.id < 0) {
            insertMemo();
            return;
        }

        updateMemo();
    }, [insertMemo, memo.id, updateMemo]);

    const editMemo = useCallback(() => {
        if (!canEdit) {
            onPermissionDenied();
            return;
        }

        onEditing();
        onFocus();

        window.setTimeout(() => {
            memoFocusRef.current?.focus();
        }, 0);
    }, [canEdit, onEditing, onFocus, onPermissionDenied]);

    const handleDoubleTap = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "touch") {
            return;
        }

        const currentTime = event.timeStamp;
        const isDoubleTap = currentTime - lastMemoTapRef.current < 300;
        lastMemoTapRef.current = currentTime;

        if (isDoubleTap) {
            event.preventDefault();
            editMemo();
        }
    };

    useEffect(() => {
        const handlePressStart = (event: PointerEvent) => {
            const target = event.target as Node;
            const targetElement = target instanceof Element ? target : null;
            const isPressInsideBoardToolBar = targetElement?.closest(".board-toolbar");
            const isPressInsideMemo = targetElement?.closest(`.memo-rnd-${memo.id}`);
            const isPressInsideBoard = targetElement?.closest(".board-scroll-layer");

            outsidePressStartedRef.current = Boolean(
                isPressInsideBoard &&
                !isPressInsideMemo &&
                !isPressInsideBoardToolBar
            );
        };

        const handlePressOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            const targetElement = target instanceof Element ? target : null;

            const isPressInsideBoardToolBar = targetElement?.closest(".board-toolbar");
            const isPressInsideMemo = targetElement?.closest(`.memo-rnd-${memo.id}`);
            const isPressInsideBoard = targetElement?.closest(".board-scroll-layer");
            const isPressInsideEmptyBoard = Boolean(
                isPressInsideBoard &&
                !isPressInsideMemo &&
                !isPressInsideBoardToolBar
            );

            const startedInsideEmptyBoard = outsidePressStartedRef.current;
            outsidePressStartedRef.current = false;

            if (isEditing && startedInsideEmptyBoard && isPressInsideEmptyBoard) {
                saveMemo();
                onEditingClear();
                return;
            }

            if (isPressInsideBoardToolBar) {
                return;
            }

            if (isPressInsideEmptyBoard && isFocused) {
                onFocusClear();
            }

        };

        document.addEventListener("pointerdown", handlePressStart);
        document.addEventListener("pointerup", handlePressOutside);

        return () => {
            document.removeEventListener("pointerdown", handlePressStart);
            document.removeEventListener("pointerup", handlePressOutside);
        };
    }, [isEditing, isFocused, memo.id, saveMemo, onEditingClear, onFocusClear]);

    const handleMemoPress = () => {
        onFocus();
    };

    const handleDragStop = (_event: RndDragEvent, data: DraggableData) => {
        setMemoState((prev) => ({ ...prev, x: data.x, y: data.y }));
    };

    const handleResizeStop: RndResizeCallback = (_event, _direction, ref, _delta, position) => {
        setMemoState({
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
        });
    };

    const openDeleteDialog = () => {
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        onDelete(memo.id);
        onEditingClear();
        setDeleteDialogOpen(false);
    };

    const closeDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    return {
        memoColor,
        setMemoColor,
        isEditing,
        memoFocusRef,
        memoState,
        memoContent,
        setMemoContent,
        deleteDialogOpen,
        dragHandlePressed,
        setDragHandlePressed,
        editMemo,
        handleDoubleTap,
        handleMemoPress,
        handleDragStop,
        handleResizeStop,
        openDeleteDialog,
        confirmDelete,
        closeDeleteDialog,
    };
}
