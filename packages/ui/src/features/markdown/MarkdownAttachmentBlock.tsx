"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Pencil } from "lucide-react";
import { createDiagramEditor, type DiagramEditor } from "@meldrift/diagram-engine";
import type { BoardDocumentAttachment } from "@meldrift/board-data/board-markdown";
import type { TableSource } from "@meldrift/core/table-card";
import TableGrid from "../table/TableGrid";
import MermaidDiagramView from "../mermaid/MermaidDiagramView";

type MarkdownAttachmentBlockProps = {
    attachment: BoardDocumentAttachment;
    previewImageUrls?: Record<string, string>;
    canEdit: boolean;
    applying: boolean;
    active: boolean;
    onActivate: () => void;
    onDeactivate: () => void;
    onChangeTable: (tableId: number, source: TableSource) => void;
    onChangeMermaid: (mermaidId: number, source: string) => void;
    onChangeImageLabel: (imageId: number, label: string | null) => void;
};

function InlineMermaidCodeEditor({
    source,
    onChange,
}: {
    source: string;
    onChange: (next: string) => void;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const fallbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const editorRef = useRef<DiagramEditor | null>(null);
    const sourceRef = useRef(source);
    const onChangeRef = useRef(onChange);
    const supportsEngineEditor = typeof createDiagramEditor === "function";

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        sourceRef.current = source;
        const editor = editorRef.current;
        if (editor && editor.getValue() !== source) {
            editor.setValue(source);
        }
    }, [source]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host || !supportsEngineEditor) {
            return;
        }
        const editor = createDiagramEditor(host, {
            value: sourceRef.current,
            onChange: (next) => {
                sourceRef.current = next;
                onChangeRef.current(next);
            },
        });
        editorRef.current = editor;
        const focusTimer = window.setTimeout(() => {
            if (typeof editor.view?.focus === "function") {
                editor.view.focus();
                return;
            }
            host.querySelector<HTMLElement>("textarea, [contenteditable='true']")?.focus();
        }, 0);
        return () => {
            window.clearTimeout(focusTimer);
            editor.destroy();
            editorRef.current = null;
        };
    }, [supportsEngineEditor]);

    useEffect(() => {
        if (!supportsEngineEditor) {
            fallbackTextareaRef.current?.focus();
        }
    }, [supportsEngineEditor]);

    if (!supportsEngineEditor) {
        return (
            <textarea
                ref={fallbackTextareaRef}
                aria-label="Mermaid source"
                value={source}
                onChange={(event) => onChange(event.target.value)}
                rows={6}
                className="w-full resize-y border-t border-neutral-200 bg-neutral-50 p-3 font-mono text-xs text-neutral-900 outline-none"
            />
        );
    }

    return <div ref={hostRef} className="h-52 border-t border-neutral-200" />;
}

export default function MarkdownAttachmentBlock({
    attachment,
    previewImageUrls,
    canEdit,
    applying,
    active,
    onActivate,
    onDeactivate,
    onChangeTable,
    onChangeMermaid,
    onChangeImageLabel,
}: MarkdownAttachmentBlockProps) {
    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const mermaidContainerRef = useRef<HTMLDivElement | null>(null);
    const imageFigureRef = useRef<HTMLElement | null>(null);
    const imageCaptionRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!active || !canEdit) {
            return;
        }
        if (attachment.kind === "table") {
            const container = tableContainerRef.current;
            container?.scrollIntoView?.({ block: "nearest" });
            if (container && !container.contains(document.activeElement)) {
                container.focus({ preventScroll: true });
            }
            return;
        }
        if (attachment.kind === "mermaid") {
            mermaidContainerRef.current?.scrollIntoView?.({ block: "nearest" });
            return;
        }
        imageFigureRef.current?.scrollIntoView?.({ block: "nearest" });
        if (imageCaptionRef.current && document.activeElement !== imageCaptionRef.current) {
            imageCaptionRef.current.focus({ preventScroll: true });
        }
    }, [active, attachment.kind, canEdit]);

    const handleEscapeDeactivate = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape" && active && canEdit) {
            event.stopPropagation();
            onDeactivate();
        }
    };

    if (attachment.kind === "table") {
        const { source, id } = attachment;
        if (active && canEdit) {
            const minHeight = Math.max(220, 94 + source.rows.length * 40);
            return (
                <div
                    ref={tableContainerRef}
                    tabIndex={-1}
                    data-linear-table-editing={id}
                    onKeyDown={handleEscapeDeactivate}
                    className="my-3 overflow-hidden rounded-xl border border-sky-300 bg-white outline-none ring-2 ring-sky-100"
                >
                    <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-3 py-1.5">
                        <span className="text-xs font-semibold text-neutral-600">Table</span>
                        <button
                            type="button"
                            onClick={onDeactivate}
                            aria-label="Finish editing table"
                            title="Done (Esc) · Next object: Alt+Enter or ⌘+Enter"
                            className="flex h-6 items-center gap-1 rounded-md bg-neutral-900 px-2 text-xs font-medium text-white hover:bg-neutral-800"
                        >
                            <Check className="h-3 w-3" />
                            Done
                        </button>
                    </div>
                    <div style={{ height: `${Math.min(minHeight, 560)}px` }}>
                        <TableGrid
                            source={source}
                            isEditing
                            onChange={(nextSource) => onChangeTable(id, nextSource)}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div
                data-linear-table={id}
                onClick={canEdit ? onActivate : undefined}
                className={`group/att relative my-3 overflow-x-auto rounded-lg ${
                    canEdit ? "cursor-pointer transition hover:ring-2 hover:ring-sky-200" : ""
                }`}
            >
                {canEdit && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onActivate();
                        }}
                        aria-label={`Edit table ${id}`}
                        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-neutral-200 bg-white/95 px-2 py-1 text-xs font-medium text-neutral-700 opacity-0 shadow-sm transition group-hover/att:opacity-100 focus:opacity-100"
                    >
                        <Pencil className="h-3 w-3" />
                        Edit table
                    </button>
                )}
                <table>
                    <thead>
                        <tr>
                            {source.columns.map((column) => (
                                <th key={column.id}>{column.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {source.rows.map((row) => (
                            <tr key={row.id}>
                                {source.columns.map((column) => (
                                    <td key={column.id} className="whitespace-pre-wrap">
                                        {row.cells[column.id] ?? ""}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (attachment.kind === "mermaid") {
        const { source, id } = attachment;
        return (
            <div
                ref={mermaidContainerRef}
                data-linear-mermaid={id}
                data-linear-mermaid-editing={active && canEdit ? id : undefined}
                onKeyDown={handleEscapeDeactivate}
                className={`group/att relative my-3 overflow-hidden rounded-xl border transition ${
                    active && canEdit
                        ? "border-sky-300 bg-white ring-2 ring-sky-100"
                        : "border-transparent hover:border-neutral-200"
                }`}
            >
                {canEdit && !active && (
                    <button
                        type="button"
                        onClick={onActivate}
                        aria-label={`Edit diagram ${id}`}
                        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-neutral-200 bg-white/95 px-2 py-1 text-xs font-medium text-neutral-700 opacity-0 shadow-sm transition group-hover/att:opacity-100 focus:opacity-100"
                    >
                        <Pencil className="h-3 w-3" />
                        Edit diagram
                    </button>
                )}
                {active && canEdit && (
                    <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-3 py-1.5">
                        <span className="text-xs font-semibold text-neutral-600">Mermaid Diagram</span>
                        <button
                            type="button"
                            onClick={onDeactivate}
                            aria-label="Finish editing diagram"
                            title="Done (Esc) · Next object: Alt+Enter or ⌘+Enter"
                            className="flex h-6 items-center gap-1 rounded-md bg-neutral-900 px-2 text-xs font-medium text-white hover:bg-neutral-800"
                        >
                            <Check className="h-3 w-3" />
                            Done
                        </button>
                    </div>
                )}
                <div onClick={canEdit && !active ? onActivate : undefined} className={canEdit && !active ? "cursor-pointer" : ""}>
                    <MermaidDiagramView
                        source={source.trim()}
                        className="mermaid-diagram-view h-72 w-full"
                    />
                </div>
                {active && canEdit && (
                    <InlineMermaidCodeEditor
                        source={source}
                        onChange={(nextSource) => onChangeMermaid(id, nextSource)}
                    />
                )}
            </div>
        );
    }

    // Image attachment
    const src = attachment.assetPath
        ? previewImageUrls?.[attachment.assetPath]
        : attachment.url;
    const alt = attachment.label?.trim() || "Image";

    return (
        <figure
            ref={imageFigureRef}
            data-linear-image={attachment.id}
            data-linear-image-editing={active && canEdit ? attachment.id : undefined}
            className={`my-4 rounded-xl transition ${
                active && canEdit ? "border border-sky-300 bg-sky-50/20 p-2 ring-2 ring-sky-100" : ""
            }`}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                onClick={canEdit ? onActivate : undefined}
                className={`mx-auto block max-h-[36rem] max-w-full rounded-lg object-contain ${canEdit ? "cursor-pointer" : ""}`}
            />
            {canEdit ? (
                <figcaption className="mt-1.5 flex justify-center">
                    <input
                        ref={imageCaptionRef}
                        type="text"
                        aria-label={`Image caption ${attachment.id}`}
                        value={attachment.label ?? ""}
                        readOnly={applying}
                        placeholder="Add image caption..."
                        onFocus={onActivate}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.stopPropagation();
                                event.currentTarget.blur();
                                onDeactivate();
                            }
                        }}
                        onChange={(event) => onChangeImageLabel(attachment.id, event.target.value)}
                        className="w-full max-w-md rounded-md border border-transparent px-2 py-0.5 text-center text-xs text-neutral-600 outline-none transition hover:border-neutral-200 focus:border-sky-300 focus:bg-neutral-50"
                    />
                </figcaption>
            ) : (
                attachment.label && (
                    <figcaption className="mt-1.5 text-center text-xs text-neutral-500">
                        {attachment.label}
                    </figcaption>
                )
            )}
        </figure>
    );
}
