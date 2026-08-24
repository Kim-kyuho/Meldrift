"use client";

import { flexRender } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useTableEdit } from "@/hooks/useTableEdit";
import { TableSource } from "@/lib/table-card";
import PressableButton from "./PressableButton";

type TableGridProps = {
    source: TableSource;
    isEditing: boolean;
    onChange: (source: TableSource) => void;
};

export default function TableGrid({ source, isEditing, onChange }: TableGridProps) {
    const {
        tableInstance,
        rowSelection,
        canDeleteSelectedRows,
        addColumn,
        addRow,
        deleteSelectedRows,
    } = useTableEdit({ source, isEditing, onChange });

    return (
        <div className="flex h-full min-h-0 flex-col text-sm text-neutral-800">
            <div className={`shrink-0 border-b border-neutral-200 p-2 ${isEditing ? "bg-white" : "bg-neutral-50 text-neutral-300"}`}>
                <div className="flex h-8 items-center gap-2 pr-10">
                    <PressableButton
                        className="flex h-8 items-center gap-1 px-2 text-xs disabled:cursor-not-allowed disabled:text-neutral-300"
                        disabled={!isEditing}
                        onClick={addRow}
                    >
                        <Plus className="h-3.5 w-3.5" /> Row
                    </PressableButton>
                    <PressableButton
                        className="flex h-8 items-center gap-1 px-2 text-xs disabled:cursor-not-allowed disabled:text-neutral-300"
                        disabled={!isEditing}
                        onClick={addColumn}
                    >
                        <Plus className="h-3.5 w-3.5" /> Column
                    </PressableButton>
                    {Object.keys(rowSelection).length > 0 && (
                        <PressableButton
                            aria-label="Delete selected rows"
                            className="flex h-8 items-center px-2 text-rose-600 disabled:cursor-not-allowed disabled:text-neutral-300"
                            disabled={!isEditing || !canDeleteSelectedRows}
                            onClick={deleteSelectedRows}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </PressableButton>
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full table-fixed border-collapse">
                    <thead className="sticky top-0 z-10 bg-neutral-100">
                        {tableInstance.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="relative border border-neutral-200 px-2 py-2 text-left"
                                        style={{
                                            width: `${(header.getSize() / tableInstance.getTotalSize()) * 100}%`,
                                        }}
                                    >
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                        {isEditing && header.column.getCanResize() && (
                                            <div
                                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none bg-sky-400/0 hover:bg-sky-400"
                                                onMouseDown={header.getResizeHandler()}
                                                onTouchStart={header.getResizeHandler()}
                                            />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {tableInstance.getRowModel().rows.map((row) => (
                            <tr key={row.id} className={row.getIsSelected() ? "bg-sky-50" : "bg-white"}>
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="h-9 border border-neutral-200 px-2 py-1 align-top"
                                        style={{
                                            width: `${(cell.column.getSize() / tableInstance.getTotalSize()) * 100}%`,
                                        }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
