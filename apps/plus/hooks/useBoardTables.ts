import { RefObject, useState } from "react";
import { defaultTableSource, TableSource } from "@/lib/table-card";

export type BoardTable = {
    id: number;
    boardId: number;
    source: TableSource;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

type UseBoardTablesOptions = {
    initialTables: BoardTable[];
    boardId: number;
    boardZoom: number;
    canEditCard: boolean;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    showPermissionMessage: () => void;
    setPermissionMessage: (message: string) => void;
    onPreviewUpdate: () => void;
};

export function useBoardTables({
    initialTables,
    boardId,
    boardZoom,
    canEditCard,
    cardLocationRef,
    showPermissionMessage,
    setPermissionMessage,
    onPreviewUpdate,
}: UseBoardTablesOptions) {
    const [tables, setTables] = useState<BoardTable[]>(initialTables);
    const [editingTableId, setEditingTableId] = useState<number | null>(null);

    const handleCreateTempTable = () => {
        if (!canEditCard) {
            showPermissionMessage();
            return;
        }

        const locationElement = cardLocationRef.current;
        const width = 560;
        const height = 360;
        const x = locationElement
            ? Math.max(0, (locationElement.scrollLeft + locationElement.clientWidth / 2) / boardZoom - width / 2)
            : 0;
        const y = locationElement
            ? Math.max(0, (locationElement.scrollTop + locationElement.clientHeight / 2) / boardZoom - height / 2)
            : 0;
        const tempTable: BoardTable = {
            id: -Date.now(),
            boardId,
            source: structuredClone(defaultTableSource),
            x: Math.round(x),
            y: Math.round(y),
            z: 1,
            width,
            height,
        };

        setTables((prev) => [...prev, tempTable]);
        setEditingTableId(tempTable.id);
    };

    const handleInsertTable = async (table: BoardTable) => {
        const response = await fetch("/api/tables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(table),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "Table could not be created.");
            return;
        }

        setTables((prev) =>
            prev.map((item) => item.id === table.id
                ? {
                    id: data.table.tableId,
                    boardId: data.table.boardId,
                    source: data.table.source,
                    x: data.table.x,
                    y: data.table.y,
                    z: data.table.z,
                    width: data.table.width,
                    height: data.table.height,
                }
                : item)
        );
        onPreviewUpdate();
    };

    const handleUpdateTable = async (table: BoardTable) => {
        const response = await fetch(`/api/tables/${table.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(table),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "Table could not be updated.");
            return;
        }

        setTables((prev) => prev.map((item) => item.id === table.id ? table : item));
        onPreviewUpdate();
    };

    const handleDeleteTable = async (id: number) => {
        if (id < 0) {
            setTables((prev) => prev.filter((table) => table.id !== id));
            setEditingTableId((prev) => prev === id ? null : prev);
            return;
        }

        const response = await fetch(`/api/tables/${id}`, { method: "DELETE" });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "Table could not be deleted.");
            return;
        }

        setTables((prev) => prev.filter((table) => table.id !== id));
        setEditingTableId((prev) => prev === id ? null : prev);
    };

    return {
        tables,
        setTables,
        editingTableId,
        setEditingTableId,
        handleCreateTempTable,
        handleInsertTable,
        handleUpdateTable,
        handleDeleteTable,
    };
}
