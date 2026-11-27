"use client";

import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import type { TableSource } from "@meldrift/core/table-card";
import { useBoardMarkdown } from "./useBoardMarkdown";
import BoardMarkdownEditor from "./BoardMarkdownEditor";

const noop = () => {};

export type BoardMarkdownViewProps = {
    snapshot: BoardSnapshot;
    onClose: () => void;
    canEdit?: boolean;
    isDirty?: boolean;
    applying?: boolean;
    closeConfirmOpen?: boolean;
    onApply?: () => void;
    onApplyAndClose?: () => void;
    onDiscardAndClose?: () => void;
    onKeepEditing?: () => void;
    onEditMemoHtml?: (memoId: number, html: string) => void;
    onEditTableSource?: (tableId: number, source: TableSource) => void;
    onEditMermaidSource?: (mermaidId: number, source: string) => void;
    onEditImageLabel?: (imageId: number, label: string | null) => void;
    onAddSection?: (insertIndex: number) => number;
    onAddTableToSection?: (memoId: number) => string | null;
    onAddMermaidToSection?: (memoId: number) => string | null;
    onAddImageToSection?: (memoId: number, file: File) => Promise<string | null> | string | null;
    onReorderSection?: (fromIndex: number, toIndex: number) => void;
    onFocusMemo?: (memoId: number) => void;
};

export default function BoardMarkdownView({
    snapshot,
    onClose,
    canEdit = false,
    isDirty = false,
    applying = false,
    closeConfirmOpen = false,
    onApply = noop,
    onApplyAndClose = noop,
    onDiscardAndClose = noop,
    onKeepEditing = noop,
    onEditMemoHtml = noop,
    onEditTableSource = noop,
    onEditMermaidSource = noop,
    onEditImageLabel = noop,
    onAddSection = () => -1,
    onAddTableToSection,
    onAddMermaidToSection,
    onAddImageToSection,
    onReorderSection = noop,
    onFocusMemo,
}: BoardMarkdownViewProps) {
    const {
        markdown,
        sections,
        unlinkedCardCount,
        previewImageUrls,
        errorMessage,
        loading,
        downloading,
        handleMarkdownDownload,
    } = useBoardMarkdown(snapshot);

    return (
        <BoardMarkdownEditor
            sections={sections}
            unlinkedCardCount={unlinkedCardCount}
            markdown={markdown}
            previewImageUrls={previewImageUrls}
            errorMessage={errorMessage}
            loading={loading}
            downloading={downloading}
            downloadTitle="Download Markdown archive"
            canEdit={canEdit}
            isDirty={isDirty}
            applying={applying}
            closeConfirmOpen={closeConfirmOpen}
            onDownload={handleMarkdownDownload}
            onApply={onApply}
            onRequestClose={onClose}
            onApplyAndClose={onApplyAndClose}
            onDiscardAndClose={onDiscardAndClose}
            onKeepEditing={onKeepEditing}
            onEditMemoHtml={onEditMemoHtml}
            onEditTableSource={onEditTableSource}
            onEditMermaidSource={onEditMermaidSource}
            onEditImageLabel={onEditImageLabel}
            onAddSection={onAddSection}
            onAddTableToSection={onAddTableToSection}
            onAddMermaidToSection={onAddMermaidToSection}
            onAddImageToSection={onAddImageToSection}
            onReorderSection={onReorderSection}
            onFocusMemo={onFocusMemo}
        />
    );
}
