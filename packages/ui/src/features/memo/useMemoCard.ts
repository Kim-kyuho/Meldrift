import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useOutsideCardPress } from "../board/useOutsideCardPress";
import { DraggableData, RndDragEvent, RndResizeCallback } from "react-rnd";
import type { MemoCardData, SelectionRect } from "@meldrift/core/cards";
import { noop } from "../../internal/noop";

export type { MemoCardData };

type UseMemoCardOptions = {
    memo: MemoCardData;
    canEdit?: boolean;
    isEditing: boolean;
    isFocused: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onFocus: () => void;
    onFocusClear: () => void;
    onPermissionDenied?: () => void;
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
        width: number,
        height: number,
        color: string
    ) => void;
    onDelete: (id: number) => void;
    onGeometryChange?: (geometry: SelectionRect) => void;
};

export function useMemoCard({
    memo,
    canEdit = true,
    isEditing,
    isFocused,
    onEditing,
    onEditingClear,
    onFocus,
    onFocusClear,
    onPermissionDenied = noop,
    onInsert,
    onUpdate,
    onDelete,
    onGeometryChange,
}: UseMemoCardOptions) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [dragHandlePressed, setDragHandlePressed] = useState(false);
    const memoFocusRef = useRef<HTMLDivElement | null>(null);
    const lastMemoTapRef = useRef(0);

    const [memoState, setMemoState] = useState({
        x: memo.x,
        y: memo.y,
        width: memo.width ?? 300,
        height: memo.height ?? 200,
    });
    const memoStateRef = useRef(memoState);
    useEffect(() => {
        memoStateRef.current = memoState;
    }, [memoState]);

    const [syncedFrame, setSyncedFrame] = useState({
        x: memo.x,
        y: memo.y,
        width: memo.width ?? 300,
        height: memo.height ?? 200,
    });
    const nextMemoWidth = memo.width ?? 300;
    const nextMemoHeight = memo.height ?? 200;
    if (
        !isEditing
        && (
            syncedFrame.x !== memo.x
            || syncedFrame.y !== memo.y
            || syncedFrame.width !== nextMemoWidth
            || syncedFrame.height !== nextMemoHeight
        )
    ) {
        const nextFrame = {
            x: memo.x,
            y: memo.y,
            width: nextMemoWidth,
            height: nextMemoHeight,
        };
        setSyncedFrame(nextFrame);
        setMemoState(nextFrame);
    }

    const [memoContent, setMemoContent] = useState(memo.content);
    const [memoColor, setMemoColor] = useState(memo.color);
    const [syncedContent, setSyncedContent] = useState({ content: memo.content, color: memo.color });
    if (!isEditing && (syncedContent.content !== memo.content || syncedContent.color !== memo.color)) {
        setSyncedContent({ content: memo.content, color: memo.color });
        setMemoContent(memo.content);
        setMemoColor(memo.color);
    }

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
        const isDoubleTap =             
            currentTime - lastMemoTapRef.current > 80 &&
            currentTime - lastMemoTapRef.current < 300;
        lastMemoTapRef.current = currentTime;

        if (isDoubleTap) {
            event.preventDefault();
            editMemo();
        }
    };

    useOutsideCardPress(isEditing || isFocused, `.memo-rnd-${memo.id}`, (startedOutside) => {
        if (isEditing && startedOutside) {
            saveMemo();
            onFocusClear();
            onEditingClear();
        } else if (isFocused) {
            onFocusClear();
        }
    });

    const handleMemoPress = () => {
        onFocus();
    };

    const handleDragStop = (_event: RndDragEvent, data: DraggableData) => {
        const next = { ...memoStateRef.current, x: data.x, y: data.y };
        memoStateRef.current = next;
        setMemoState(next);
        onGeometryChange?.(next);
    };

    const handleResizeStop: RndResizeCallback = (_event, _direction, ref, _delta, position) => {
        const next = {
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
        };
        memoStateRef.current = next;
        setMemoState(next);
        onGeometryChange?.(next);
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
