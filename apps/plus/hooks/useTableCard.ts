import { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { DraggableData, RndDragEvent, RndResizeCallback } from "react-rnd";
import { BoardTable } from "@/hooks/useBoardTables";
import { TableSource } from "@/lib/table-card";

type UseTableCardOptions = {
    table: BoardTable;
    canEdit: boolean;
    isEditing: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onPermissionDenied: () => void;
    onInsert: (table: BoardTable) => void;
    onUpdate: (table: BoardTable) => void;
    onDelete: (id: number) => void;
};

export function useTableCard({
    table,
    canEdit,
    isEditing,
    onEditing,
    onEditingClear,
    onPermissionDenied,
    onInsert,
    onUpdate,
    onDelete,
}: UseTableCardOptions) {
    const [source, setSource] = useState<TableSource>(table.source);
    const [cardState, setCardState] = useState({
        x: table.x,
        y: table.y,
        width: table.width,
        height: table.height,
    });
    const [dragHandlePressed, setDragHandlePressed] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const sourceRef = useRef(source);
    const cardStateRef = useRef(cardState);
    const lastTapRef = useRef(0);
    // 카드 내부에서 드래그하여 카드 외부에서 Pointer up이벤트가 발상한 경우 내용 저장을 방지하기 위한 Ref
    const outsidePressStartedRef = useRef(false);

    useEffect(() => {
        sourceRef.current = source;
    }, [source]);

    useEffect(() => {
        cardStateRef.current = cardState;
    }, [cardState]);

    const saveTable = useCallback(() => {
        const current = cardStateRef.current;
        const nextTable: BoardTable = {
            ...table,
            source: sourceRef.current,
            x: Math.round(current.x),
            y: Math.round(current.y),
            width: Math.round(current.width),
            height: Math.round(current.height),
        };

        if (table.id < 0) {
            onInsert(nextTable);
            return;
        }

        onUpdate(nextTable);
    }, [onInsert, onUpdate, table]);

    const editTable = () => {
        if (!canEdit) {
            onPermissionDenied();
            return;
        }
        onEditing();
    };

    const handleDoubleTap = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "touch") return;

        const isDoubleTap = event.timeStamp - lastTapRef.current < 300;
        lastTapRef.current = event.timeStamp;
        if (isDoubleTap) editTable();
    };

    useEffect(() => {
        const handlePressStart = (event: PointerEvent) => {
            const target = event.target;
            const element = target instanceof Element ? target : null;
            const isPressInsideCard = element?.closest(`.table-rnd-${table.id}`);
            const isPressInsideToolBar = element?.closest(".board-toolbar");
            const isPressInsideDialog = element?.closest(".confirm-dialog");
            const isPressInsideBoard = element?.closest(".board-scroll-layer");

            outsidePressStartedRef.current = Boolean(
                isPressInsideBoard &&
                !isPressInsideCard &&
                !isPressInsideToolBar &&
                !isPressInsideDialog
            );
        };

        const handlePressOutside = (event: PointerEvent) => {
            const target = event.target;
            const element = target instanceof Element ? target : null;
            const isPressInsideCard = element?.closest(`.table-rnd-${table.id}`);
            const isPressInsideToolBar = element?.closest(".board-toolbar");
            const isPressInsideDialog = element?.closest(".confirm-dialog");
            const isPressInsideBoard = element?.closest(".board-scroll-layer");
            const isPressInsideEmptyBoard = Boolean(
                isPressInsideBoard &&
                !isPressInsideCard &&
                !isPressInsideToolBar &&
                !isPressInsideDialog
            );

            const startedInsideEmptyBoard = outsidePressStartedRef.current;
            outsidePressStartedRef.current = false;

            if (isEditing && startedInsideEmptyBoard && isPressInsideEmptyBoard) {
                saveTable();
                onEditingClear();
            }
        };

        document.addEventListener("pointerdown", handlePressStart);
        document.addEventListener("pointerup", handlePressOutside);
        return () => {
            document.removeEventListener("pointerdown", handlePressStart);
            document.removeEventListener("pointerup", handlePressOutside);
        };
    }, [isEditing, onEditingClear, saveTable, table.id]);

    const handleTablePress = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const handleDragStop = (_event: RndDragEvent, data: DraggableData) => {
        const next = { ...cardStateRef.current, x: data.x, y: data.y };
        cardStateRef.current = next;
        setCardState(next);
    };

    const handleResizeStop: RndResizeCallback = (_event, _direction, ref, _delta, position) => {
        const next = {
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
        };
        cardStateRef.current = next;
        setCardState(next);
    };

    const confirmDelete = () => {
        onDelete(table.id);
        onEditingClear();
        setDeleteDialogOpen(false);
    };

    return {
        source,
        setSource,
        cardState,
        dragHandlePressed,
        setDragHandlePressed,
        deleteDialogOpen,
        editTable,
        handleDoubleTap,
        handleTablePress,
        handleDragStop,
        handleResizeStop,
        openDeleteDialog: () => {
            setDeleteDialogOpen(true);
        },
        closeDeleteDialog: () => setDeleteDialogOpen(false),
        confirmDelete,
    };
}
