"use client";

import { useEffect, useRef } from "react";
import { createTable, type Table } from "@meldrift/table-engine";
import type { TableSource } from "@meldrift/core/table-card";

type TableGridProps = {
    source: TableSource;
    isEditing: boolean;
    onChange: (source: TableSource) => void;
};

export default function TableGrid({ source, isEditing, onChange }: TableGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<Table | null>(null);
    const sourceRef = useRef(source);
    const isEditingRef = useRef(isEditing);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const table = createTable(container, {
            source: sourceRef.current,
            editable: isEditingRef.current,
            onChange: (nextSource) => {
                sourceRef.current = nextSource;
                onChangeRef.current(nextSource);
            },
        });
        tableRef.current = table;

        return () => {
            table.destroy();
            tableRef.current = null;
        };
    }, []);

    useEffect(() => {
        isEditingRef.current = isEditing;
        tableRef.current?.setEditable(isEditing);
    }, [isEditing]);

    // 엔진이 알린 값과 같은 객체면 엔진이 무시하므로, 밖에서 바뀐 값만 다시 들어간다.
    useEffect(() => {
        sourceRef.current = source;
        tableRef.current?.setSource(source);
    }, [source]);

    return <div ref={containerRef} className="h-full" />;
}
