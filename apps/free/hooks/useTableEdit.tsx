import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import {
    ColumnDef,
    ColumnSizingState,
    CellContext,
    HeaderContext,
    RowSelectionState,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { X } from "lucide-react";
import { createTableItemId, TableSource } from "@/lib/table-card";

type UseTableEditOptions = {
    source: TableSource;
    isEditing: boolean;
    onChange: (source: TableSource) => void;
};

type TableRow = TableSource["rows"][number];

type TableEditMeta = {
    source: TableSource;
    isEditing: boolean;
    updateCell: (rowId: string, columnId: string, value: string) => void;
    renameColumn: (columnId: string, name: string) => void;
    deleteColumn: (columnId: string) => void;
};

const getTableEditMeta = (meta: unknown) => meta as TableEditMeta;

function SelectHeader({ table }: HeaderContext<TableRow, unknown>) {
    const meta = getTableEditMeta(table.options.meta);

    return (
        <input
            type="checkbox"
            aria-label="Select all rows"
            checked={table.getIsAllRowsSelected()}
            disabled={!meta.isEditing}
            className="disabled:cursor-not-allowed disabled:opacity-30"
            onChange={table.getToggleAllRowsSelectedHandler()}
        />
    );
}

function SelectCell({ row, table }: CellContext<TableRow, unknown>) {
    const meta = getTableEditMeta(table.options.meta);

    return (
        <input
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            disabled={!meta.isEditing}
            className="disabled:cursor-not-allowed disabled:opacity-30"
            onChange={row.getToggleSelectedHandler()}
        />
    );
}

function TableColumnHeader({ column, table }: HeaderContext<TableRow, unknown>) {
    const meta = getTableEditMeta(table.options.meta);
    const sourceColumn = meta.source.columns.find((item) => item.id === column.id);

    if (!sourceColumn) return null;

    return (
        <div className="flex min-w-0 items-center gap-1">
            {meta.isEditing ? (
                <input
                    value={sourceColumn.name}
                    aria-label="Column name"
                    className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
                    onChange={(event) => meta.renameColumn(column.id, event.target.value)}
                />
            ) : (
                <span className="min-w-0 flex-1 truncate">{sourceColumn.name}</span>
            )}
            {meta.isEditing && meta.source.columns.length > 1 && (
                <button
                    type="button"
                    aria-label={`Delete ${sourceColumn.name}`}
                    className="shrink-0 text-neutral-300 hover:text-rose-500"
                    onClick={() => meta.deleteColumn(column.id)}
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

function TableColumnCell({ row, column, table }: CellContext<TableRow, unknown>) {
    const meta = getTableEditMeta(table.options.meta);
    const value = row.original.cells[column.id] ?? "";
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;

        if (!textarea || !meta.isEditing) return;

        textarea.style.height = "0";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [meta.isEditing, value]);

    return meta.isEditing ? (
        <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            className="block min-h-7 w-full resize-none overflow-hidden whitespace-pre-wrap bg-transparent outline-none"
            style={{ overflowWrap: "anywhere" }}
            onChange={(event) => meta.updateCell(row.original.id, column.id, event.target.value)}
        />
    ) : (
        <span className="whitespace-pre-wrap wrap-break-words">{value}</span>
    );
}

export function useTableEdit({ source, isEditing, onChange }: UseTableEditOptions) {
    const sourceRef = useRef(source);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
        Object.fromEntries(source.columns.map((column) => [column.id, column.width ?? 160]))
    );

    useEffect(() => {
        sourceRef.current = source;
    }, [source]);

    useEffect(() => {
        if (!isEditing) {
            setRowSelection({});
        }
    }, [isEditing]);

    useEffect(() => {
        const currentSource = sourceRef.current;
        const widthChanged = currentSource.columns.some(
            (column) => Math.round(columnSizing[column.id] ?? 160) !== Math.round(column.width ?? 160)
        );

        if (!widthChanged) return;

        onChange({
            ...currentSource,
            columns: currentSource.columns.map((column) => ({
                ...column,
                width: Math.round(columnSizing[column.id] ?? column.width ?? 160),
            })),
        });
    }, [columnSizing, onChange]);

    const updateCell = useCallback((rowId: string, columnId: string, value: string) => {
        const currentSource = sourceRef.current;

        onChange({
            ...currentSource,
            rows: currentSource.rows.map((row) => row.id === rowId
                ? { ...row, cells: { ...row.cells, [columnId]: value } }
                : row),
        });
    }, [onChange]);

    const renameColumn = useCallback((columnId: string, name: string) => {
        const currentSource = sourceRef.current;

        onChange({
            ...currentSource,
            columns: currentSource.columns.map((column) => column.id === columnId ? { ...column, name } : column),
        });
    }, [onChange]);

    const deleteColumn = useCallback((columnId: string) => {
        const currentSource = sourceRef.current;
        if (currentSource.columns.length === 1) return;

        onChange({
            columns: currentSource.columns.filter((column) => column.id !== columnId),
            rows: currentSource.rows.map((row) => {
                const cells = { ...row.cells };
                delete cells[columnId];
                return { ...row, cells };
            }),
        });
    }, [onChange]);

    const columnStructureKey = source.columns
        .map((column) => `${column.id}:${column.width ?? 160}`)
        .join("|");

    const columns = useMemo<ColumnDef<TableRow>[]>(() => [
        {
            id: "select",
            size: 32,
            enableSorting: false,
            enableColumnFilter: false,
            enableResizing: false,
            header: SelectHeader,
            cell: SelectCell,
        } satisfies ColumnDef<TableRow>,
        ...source.columns.map((sourceColumn) => ({
            id: sourceColumn.id,
            accessorFn: (row) => row.cells[sourceColumn.id] ?? "",
            size: sourceColumn.width ?? 160,
            minSize: 80,
            header: TableColumnHeader,
            cell: TableColumnCell,
        } satisfies ColumnDef<TableRow>)),
        // input 재마운트를 방지하기 위해 source.columns 대신 columnStructureKey로 열 구조 변경만 감지
        // 의존성 배열에 source.columns가 포함되지 않아 출력되는 의존성 경고를 막기 위해 주석 추가
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [columnStructureKey]);

    // React 컴파일러의 자동 최적화 경고를 막기 위해 주석 추가
    // eslint-disable-next-line react-hooks/incompatible-library
    const tableInstance = useReactTable({
        data: source.rows,
        columns,
        meta: {
            source,
            isEditing,
            updateCell,
            renameColumn,
            deleteColumn,
        } satisfies TableEditMeta,
        state: {
            rowSelection,
            columnSizing,
        },
        onRowSelectionChange: setRowSelection,
        onColumnSizingChange: setColumnSizing,
        getRowId: (row) => row.id,
        enableRowSelection: isEditing,
        columnResizeMode: "onChange",
        getCoreRowModel: getCoreRowModel(),
    });

    const addColumn = () => {
        const currentSource = sourceRef.current;
        const id = createTableItemId();
        onChange({
            columns: [...currentSource.columns, { id, name: `Column ${currentSource.columns.length + 1}`, width: 160 }],
            rows: currentSource.rows.map((row) => ({ ...row, cells: { ...row.cells, [id]: "" } })),
        });
    };

    const addRow = () => {
        const currentSource = sourceRef.current;
        onChange({
            ...currentSource,
            rows: [...currentSource.rows, {
                id: createTableItemId(),
                cells: Object.fromEntries(currentSource.columns.map((column) => [column.id, ""])),
            }],
        });
    };

    const deleteSelectedRows = () => {
        const currentSource = sourceRef.current;
        const selectedIds = new Set(tableInstance.getSelectedRowModel().rows.map((row) => row.original.id));
        const remainingRows = currentSource.rows.filter((row) => !selectedIds.has(row.id));

        if (remainingRows.length === 0) return;

        onChange({ ...currentSource, rows: remainingRows });
        setRowSelection({});
    };

    const selectedRowCount = tableInstance.getSelectedRowModel().rows.length;
    const canDeleteSelectedRows = source.rows.length - selectedRowCount >= 1;

    return {
        tableInstance,
        rowSelection,
        canDeleteSelectedRows,
        addColumn,
        addRow,
        deleteSelectedRows,
    };
}
