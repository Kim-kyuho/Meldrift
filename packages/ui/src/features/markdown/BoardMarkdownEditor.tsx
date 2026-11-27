"use client";

import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
    ArrowDown,
    ArrowUp,
    Camera,
    Check,
    Download,
    GripVertical,
    Plus,
    Table2,
    Workflow,
    X,
} from "lucide-react";
import type { BoardDocumentSection } from "@meldrift/board-data/board-markdown";
import { maxAttachmentsPerMemo } from "@meldrift/board-data/board-markdown-draft";
import { imageInputAccept } from "@meldrift/board-data/image-file";
import type { TableSource } from "@meldrift/core/table-card";
import PressableButton from "../../shared/PressableButton";
import MarkdownMemoBlock from "./MarkdownMemoBlock";
import MarkdownAttachmentBlock from "./MarkdownAttachmentBlock";

export type BoardMarkdownEditorProps = {
    sections: BoardDocumentSection[];
    unlinkedCardCount: number;
    markdown: string;
    previewImageUrls?: Record<string, string>;
    errorMessage: string;
    loading: boolean;
    downloading?: boolean;
    downloadTitle?: string;
    canEdit: boolean;
    isDirty: boolean;
    applying: boolean;
    closeConfirmOpen: boolean;
    onDownload: () => void;
    onApply: () => void;
    onRequestClose: () => void;
    onApplyAndClose: () => void;
    onDiscardAndClose: () => void;
    onKeepEditing: () => void;
    onEditMemoHtml: (memoId: number, html: string) => void;
    onEditTableSource: (tableId: number, source: TableSource) => void;
    onEditMermaidSource: (mermaidId: number, source: string) => void;
    onEditImageLabel: (imageId: number, label: string | null) => void;
    onAddSection: (insertIndex: number) => number;
    onAddTableToSection?: (memoId: number) => string | null;
    onAddMermaidToSection?: (memoId: number) => string | null;
    onAddImageToSection?: (memoId: number, file: File) => Promise<string | null> | string | null;
    onReorderSection: (fromIndex: number, toIndex: number) => void;
    onFocusMemo?: (memoId: number) => void;
};

type ActiveBlock =
    | { kind: "memo"; memoId: number }
    | { kind: "attachment"; key: string }
    | null;

type OrderedBlock =
    | { kind: "memo"; memoId: number }
    | { kind: "attachment"; key: string; memoId: number };

export default function BoardMarkdownEditor({
    sections,
    unlinkedCardCount,
    markdown,
    previewImageUrls,
    errorMessage,
    loading,
    downloading = false,
    downloadTitle = "Download Markdown archive",
    canEdit,
    isDirty,
    applying,
    closeConfirmOpen,
    onDownload,
    onApply,
    onRequestClose,
    onApplyAndClose,
    onDiscardAndClose,
    onKeepEditing,
    onEditMemoHtml,
    onEditTableSource,
    onEditMermaidSource,
    onEditImageLabel,
    onAddSection,
    onAddTableToSection,
    onAddMermaidToSection,
    onAddImageToSection,
    onReorderSection,
    onFocusMemo,
}: BoardMarkdownEditorProps) {
    const [activeBlock, setActiveBlock] = useState<ActiveBlock>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
    const dragStateRef = useRef<{ pointerId: number; fromIndex: number } | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const imageTargetMemoIdRef = useRef<number | null>(null);

    const orderedBlocks = useMemo<OrderedBlock[]>(() => {
        const list: OrderedBlock[] = [];
        for (const section of sections) {
            list.push({ kind: "memo", memoId: section.memoId });
            for (const attachment of section.attachments) {
                list.push({ kind: "attachment", key: attachment.key, memoId: section.memoId });
            }
        }
        return list;
    }, [sections]);

    const activateOrderedBlock = (target: OrderedBlock) => {
        const currentEl = document.activeElement;
        if (currentEl instanceof HTMLElement) {
            currentEl.blur();
        }
        if (target.kind === "memo") {
            setActiveBlock({ kind: "memo", memoId: target.memoId });
        } else {
            setActiveBlock({ kind: "attachment", key: target.key });
        }
        onFocusMemo?.(target.memoId);
    };

    const navigateOrderedBlock = (direction: 1 | -1) => {
        if (orderedBlocks.length === 0) {
            return;
        }
        const currentIndex = activeBlock
            ? orderedBlocks.findIndex((block) =>
                activeBlock.kind === "memo"
                    ? block.kind === "memo" && block.memoId === activeBlock.memoId
                    : block.kind === "attachment" && block.key === activeBlock.key)
            : -1;

        if (currentIndex < 0) {
            const target = direction > 0 ? orderedBlocks[0] : orderedBlocks[orderedBlocks.length - 1];
            activateOrderedBlock(target);
            return;
        }

        const nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= orderedBlocks.length) {
            return;
        }
        activateOrderedBlock(orderedBlocks[nextIndex]);
    };

    const handleEditorKeyDownCapture = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (!canEdit || closeConfirmOpen || orderedBlocks.length === 0) {
            return;
        }
        if (event.key !== "Enter" || (!event.altKey && !event.metaKey) || event.ctrlKey) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopPropagation();
        navigateOrderedBlock(event.shiftKey ? -1 : 1);
    };

    const handleInsertSection = (insertIndex: number) => {
        if (!canEdit) {
            return;
        }
        const newMemoId = onAddSection(insertIndex);
        setActiveBlock({ kind: "memo", memoId: newMemoId });
    };

    const handleAddTable = (memoId: number) => {
        if (!canEdit || !onAddTableToSection) {
            return;
        }
        const key = onAddTableToSection(memoId);
        if (key) {
            setActiveBlock({ kind: "attachment", key });
        }
    };

    const handleAddMermaid = (memoId: number) => {
        if (!canEdit || !onAddMermaidToSection) {
            return;
        }
        const key = onAddMermaidToSection(memoId);
        if (key) {
            setActiveBlock({ kind: "attachment", key });
        }
    };

    const handleTriggerImageUpload = (memoId: number) => {
        if (!canEdit || !onAddImageToSection || uploadingImage || applying) {
            return;
        }
        imageTargetMemoIdRef.current = memoId;
        imageInputRef.current?.click();
    };

    const handleSectionImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        const targetMemoId = imageTargetMemoIdRef.current;
        imageTargetMemoIdRef.current = null;
        if (!file || targetMemoId === null || !canEdit || !onAddImageToSection || uploadingImage || applying) {
            return;
        }
        setUploadingImage(true);
        try {
            const key = await onAddImageToSection(targetMemoId, file);
            if (key) {
                setActiveBlock({ kind: "attachment", key });
            }
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSectionDragStart = (event: ReactPointerEvent<HTMLButtonElement>, fromIndex: number) => {
        if (!canEdit || (event.pointerType === "mouse" && event.button !== 0)) {
            return;
        }
        event.preventDefault();
        setActiveBlock(null);
        dragStateRef.current = { pointerId: event.pointerId, fromIndex };
        setDraggingIndex(fromIndex);
        setDropIndex(fromIndex);
        if (typeof event.currentTarget.setPointerCapture === "function") {
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Ignore unsupported capture.
            }
        }
    };

    const handleSectionDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        let target = sections.length - 1;
        for (let index = 0; index < sections.length; index += 1) {
            const node = sectionRefs.current[index];
            if (!node) {
                continue;
            }
            const rect = node.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                target = index;
                break;
            }
        }
        setDropIndex(target);
    };

    const finishSectionDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        dragStateRef.current = null;
        if (typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        const target = dropIndex;
        setDraggingIndex(null);
        setDropIndex(null);
        if (!cancelled && target !== null && target !== drag.fromIndex) {
            onReorderSection(drag.fromIndex, target);
        }
    };

    return (
        <>
            <input
                ref={imageInputRef}
                type="file"
                accept={imageInputAccept}
                aria-label="Add image to section"
                className="hidden"
                onChange={handleSectionImageChange}
            />
            <section
                aria-label="Compiled Markdown document"
                onKeyDownCapture={handleEditorKeyDownCapture}
                className="flex h-full w-full flex-col overflow-hidden bg-white text-neutral-900"
            >
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2.5 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-base font-bold text-neutral-900">
                            Compiled Markdown
                        </h2>
                        {!canEdit ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                                Read-only
                            </span>
                        ) : isDirty ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                                Unsaved
                            </span>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {canEdit && (
                            <button
                                type="button"
                                onClick={onApply}
                                disabled={!isDirty || applying || uploadingImage}
                                aria-label="Apply Markdown changes"
                                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                                    isDirty && !applying && !uploadingImage
                                        ? "bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 active:scale-[0.98]"
                                        : "cursor-not-allowed bg-neutral-100 text-neutral-400"
                                }`}
                            >
                                <Check className="h-3.5 w-3.5" />
                                {applying ? "Applying..." : "Apply"}
                            </button>
                        )}
                        <PressableButton
                            className="flex h-8 w-8 items-center justify-center p-0"
                            onClick={onDownload}
                            disabled={!markdown || downloading}
                            aria-label="Download Markdown"
                            title={downloadTitle}
                        >
                            <Download className="h-4 w-4" />
                        </PressableButton>
                        <PressableButton
                            className="flex h-8 w-8 items-center justify-center p-0"
                            onClick={onRequestClose}
                            disabled={applying}
                            aria-label="Close Markdown view"
                        >
                            <X className="h-4 w-4" />
                        </PressableButton>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-8 sm:py-6">
                    {uploadingImage && (
                        <p role="status" className="mb-3 text-sm text-neutral-500">Preparing image...</p>
                    )}
                    {loading && (
                        <p role="status" className="mb-3 text-sm text-neutral-500">Loading image previews...</p>
                    )}
                    {errorMessage && (
                        <p role="alert" className="mb-3 text-sm font-semibold text-rose-600">{errorMessage}</p>
                    )}
                    {sections.length === 0 ? (
                        <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
                            <p className="text-sm text-neutral-500">No memo content exists.</p>
                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() => handleInsertSection(0)}
                                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add first section
                                </button>
                            )}
                        </div>
                    ) : (
                        <article className="board-markdown-content pb-16">
                            {sections.map((section, index) => {
                                const memoActive = activeBlock?.kind === "memo" && activeBlock.memoId === section.memoId;
                                const isDragging = draggingIndex === index;
                                const showDropBefore = draggingIndex !== null && dropIndex === index && draggingIndex !== index;

                                return (
                                    <div
                                        key={section.key}
                                        ref={(node) => { sectionRefs.current[index] = node; }}
                                        data-linear-section={section.memoId}
                                        className={`group/section relative rounded-xl transition ${
                                            isDragging ? "opacity-50 ring-2 ring-sky-300" : ""
                                        } ${showDropBefore ? "border-t-2 border-sky-500 pt-2" : ""}`}
                                    >
                                        {canEdit && (
                                            <div className="mb-1 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/section:opacity-100 sm:group-focus-within/section:opacity-100">
                                                <button
                                                    type="button"
                                                    aria-label={`Drag to reorder section ${index + 1}`}
                                                    title="Drag to reorder section"
                                                    onPointerDown={(event) => handleSectionDragStart(event, index)}
                                                    onPointerMove={handleSectionDragMove}
                                                    onPointerUp={(event) => finishSectionDrag(event, false)}
                                                    onPointerCancel={(event) => finishSectionDrag(event, true)}
                                                    className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
                                                    style={{ touchAction: "none" }}
                                                >
                                                    <GripVertical className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onFocusMemo?.(section.memoId)}
                                                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                                                    title="Jump to memo card on canvas"
                                                >
                                                    #{index + 1}
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Move section ${index + 1} up`}
                                                    disabled={index === 0}
                                                    onClick={() => onReorderSection(index, index - 1)}
                                                    className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                                                >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Move section ${index + 1} down`}
                                                    disabled={index === sections.length - 1}
                                                    onClick={() => onReorderSection(index, index + 1)}
                                                    className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                                                >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Add section after ${index + 1}`}
                                                    onClick={() => handleInsertSection(index + 1)}
                                                    className="ml-auto inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                                                >
                                                    <Plus className="h-3 w-3" />
                                                    Add below
                                                </button>
                                            </div>
                                        )}

                                        <MarkdownMemoBlock
                                            memoId={section.memoId}
                                            html={section.html}
                                            canEdit={canEdit}
                                            active={memoActive}
                                            onActivate={() => {
                                                setActiveBlock({ kind: "memo", memoId: section.memoId });
                                                onFocusMemo?.(section.memoId);
                                            }}
                                            onDeactivate={() => setActiveBlock(null)}
                                            onChange={(nextHtml) => onEditMemoHtml(section.memoId, nextHtml)}
                                            onNavigatePrev={index > 0
                                                ? () => setActiveBlock({ kind: "memo", memoId: sections[index - 1].memoId })
                                                : undefined}
                                            onNavigateNext={index < sections.length - 1
                                                ? () => setActiveBlock({ kind: "memo", memoId: sections[index + 1].memoId })
                                                : undefined}
                                        />

                                        {section.attachments.map((attachment) => (
                                            <MarkdownAttachmentBlock
                                                key={attachment.key}
                                                attachment={attachment}
                                                previewImageUrls={previewImageUrls}
                                                canEdit={canEdit}
                                                applying={applying}
                                                active={activeBlock?.kind === "attachment" && activeBlock.key === attachment.key}
                                                onActivate={() => setActiveBlock({ kind: "attachment", key: attachment.key })}
                                                onDeactivate={() => setActiveBlock(null)}
                                                onChangeTable={onEditTableSource}
                                                onChangeMermaid={onEditMermaidSource}
                                                onChangeImageLabel={onEditImageLabel}
                                            />
                                        ))}

                                        {canEdit && (
                                            <div className="mt-1.5 flex flex-wrap items-center gap-1 opacity-100 transition-opacity sm:opacity-60 sm:group-hover/section:opacity-100 sm:group-focus-within/section:opacity-100">
                                                <button
                                                    type="button"
                                                    disabled={section.attachments.length >= maxAttachmentsPerMemo}
                                                    onClick={() => handleAddTable(section.memoId)}
                                                    aria-label={`Add table to section ${index + 1}`}
                                                    title={section.attachments.length >= maxAttachmentsPerMemo
                                                        ? `Maximum ${maxAttachmentsPerMemo} attachments per memo`
                                                        : "Add table card to this section"}
                                                    className="inline-flex h-6 items-center gap-1 rounded-md border border-neutral-200/80 bg-white px-2 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <Table2 className="h-3 w-3" />
                                                    Table
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={section.attachments.length >= maxAttachmentsPerMemo}
                                                    onClick={() => handleAddMermaid(section.memoId)}
                                                    aria-label={`Add diagram to section ${index + 1}`}
                                                    title={section.attachments.length >= maxAttachmentsPerMemo
                                                        ? `Maximum ${maxAttachmentsPerMemo} attachments per memo`
                                                        : "Add Mermaid diagram to this section"}
                                                    className="inline-flex h-6 items-center gap-1 rounded-md border border-neutral-200/80 bg-white px-2 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <Workflow className="h-3 w-3" />
                                                    Mermaid
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={section.attachments.length >= maxAttachmentsPerMemo || uploadingImage || applying}
                                                    onClick={() => handleTriggerImageUpload(section.memoId)}
                                                    aria-label={`Add image to section ${index + 1}`}
                                                    title={section.attachments.length >= maxAttachmentsPerMemo
                                                        ? `Maximum ${maxAttachmentsPerMemo} attachments per memo`
                                                        : "Add image card to this section"}
                                                    className="inline-flex h-6 items-center gap-1 rounded-md border border-neutral-200/80 bg-white px-2 text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <Camera className="h-3 w-3" />
                                                    Image
                                                </button>
                                                <span
                                                    className={`ml-1 text-[11px] font-medium ${
                                                        section.attachments.length >= maxAttachmentsPerMemo
                                                            ? "text-amber-600"
                                                            : "text-neutral-400"
                                                    }`}
                                                >
                                                    {section.attachments.length}/{maxAttachmentsPerMemo}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {canEdit && (
                                <div className="mt-6 flex justify-center border-t border-dashed border-neutral-200 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleInsertSection(sections.length)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-xs transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add section
                                    </button>
                                </div>
                            )}

                            {unlinkedCardCount > 0 && (
                                <p className="mt-6 rounded-lg bg-neutral-50 px-3 py-2 text-center text-xs text-neutral-500">
                                    {unlinkedCardCount} unlinked {unlinkedCardCount === 1 ? "card" : "cards"} on the canvas {unlinkedCardCount === 1 ? "is" : "are"} not attached to any memo corner and not included in this document.
                                </p>
                            )}
                        </article>
                    )}
                </div>
            </section>

            {closeConfirmOpen && createPortal(
                <>
                    <div
                        className="confirm-dialog fixed inset-0 bg-black/50"
                        style={{ zIndex: 70000 }}
                        onClick={onKeepEditing}
                    />
                    <div
                        className="confirm-dialog fixed left-1/2 top-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 text-neutral-900 shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Apply Markdown changes?"
                        style={{ zIndex: 70001 }}
                    >
                        <h3 className="text-base font-bold text-neutral-900">
                            Apply Markdown changes?
                        </h3>
                        <p className="mt-2 text-sm text-neutral-600">
                            You have unapplied changes in the Markdown editor. Apply them to the board cards before closing, or discard them?
                        </p>
                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={onKeepEditing}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                onClick={onDiscardAndClose}
                                disabled={applying}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                            >
                                Discard &amp; Close
                            </button>
                            <button
                                type="button"
                                disabled={applying || uploadingImage}
                                onClick={onApplyAndClose}
                                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {applying ? "Applying..." : "Apply & Close"}
                            </button>
                        </div>
                    </div>
                </>,
                document.body,
            )}
        </>
    );
}
