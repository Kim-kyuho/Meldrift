"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import type { TableSource } from "@meldrift/core/table-card";
import { prepareImageFile } from "@meldrift/board-data/image-file";
import {
    applyLinearDraftToSnapshot,
    createDraftImageAttachment,
    createDraftMemoSection,
    createDraftMermaidAttachment,
    createDraftTableAttachment,
    createEmptyLinearDraft,
    isLinearDraftDirty,
    maxAttachmentsPerMemo,
    reorderDraftMemoSections,
    updateDraftImageLabel,
    updateDraftMemoHtml,
    updateDraftMermaidSource,
    updateDraftTableSource,
    type LinearMarkdownDraft,
} from "@meldrift/board-data/board-markdown-draft";

type UseLinearMarkdownDraftOptions = {
    open: boolean;
    canEdit: boolean;
    committedSnapshot: BoardSnapshot;
    onCommit: (nextSnapshot: BoardSnapshot, clearDraft: () => void) => Promise<boolean> | boolean;
    onClose: () => void;
    onMessage?: (message: string) => void;
};

export function useLinearMarkdownDraft({
    open,
    canEdit,
    committedSnapshot,
    onCommit,
    onClose,
    onMessage,
}: UseLinearMarkdownDraftOptions) {
    const [draft, setDraft] = useState<LinearMarkdownDraft>(createEmptyLinearDraft);
    const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
    const [applying, setApplying] = useState(false);
    const activeBoardId = open ? committedSnapshot.board.boardId : null;
    const [previousBoardId, setPreviousBoardId] = useState(activeBoardId);
    if (activeBoardId !== previousBoardId) {
        setPreviousBoardId(activeBoardId);
        setDraft(createEmptyLinearDraft());
        setCloseConfirmOpen(false);
    }

    const committedRef = useRef(committedSnapshot);
    const draftRef = useRef(draft);
    const onCommitRef = useRef(onCommit);
    const onCloseRef = useRef(onClose);
    const onMessageRef = useRef(onMessage);
    const pendingImageRef = useRef<symbol | null>(null);

    useEffect(() => {
        committedRef.current = committedSnapshot;
        draftRef.current = draft;
        onCommitRef.current = onCommit;
        onCloseRef.current = onClose;
        onMessageRef.current = onMessage;
    });

    const isDirty = useMemo(
        () => open && canEdit && isLinearDraftDirty(committedSnapshot, draft),
        [open, canEdit, committedSnapshot, draft],
    );

    const displaySnapshot = useMemo(
        () => (isDirty ? applyLinearDraftToSnapshot(committedSnapshot, draft, { finalizeIds: false }) : committedSnapshot),
        [isDirty, committedSnapshot, draft],
    );

    useEffect(() => () => {
        pendingImageRef.current = null;
    }, [activeBoardId]);

    // 미적용 변경이 있을 때 브라우저 탭을 실수로 닫지 않도록 보호한다.
    useEffect(() => {
        if (!isDirty) {
            return;
        }
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    const editMemoHtml = useCallback((memoId: number, html: string) => {
        const next = updateDraftMemoHtml(committedRef.current, draftRef.current, memoId, html);
        draftRef.current = next;
        setDraft(next);
    }, []);

    const editTableSource = useCallback((tableId: number, source: TableSource) => {
        const next = updateDraftTableSource(committedRef.current, draftRef.current, tableId, source);
        draftRef.current = next;
        setDraft(next);
    }, []);

    const editMermaidSource = useCallback((mermaidId: number, source: string) => {
        const next = updateDraftMermaidSource(committedRef.current, draftRef.current, mermaidId, source);
        draftRef.current = next;
        setDraft(next);
    }, []);

    const editImageLabel = useCallback((imageId: number, label: string | null) => {
        const next = updateDraftImageLabel(committedRef.current, draftRef.current, imageId, label);
        draftRef.current = next;
        setDraft(next);
    }, []);

    const addSection = useCallback((insertIndex: number): number => {
        const result = createDraftMemoSection(committedRef.current, draftRef.current, insertIndex);
        draftRef.current = result.draft;
        setDraft(result.draft);
        return result.memo.id;
    }, []);

    const addTableToSection = useCallback((memoId: number): string | null => {
        const result = createDraftTableAttachment(committedRef.current, draftRef.current, memoId);
        if (!result) {
            onMessageRef.current?.(`You can attach up to ${maxAttachmentsPerMemo} items per memo.`);
            return null;
        }
        draftRef.current = result.draft;
        setDraft(result.draft);
        return result.key;
    }, []);

    const addMermaidToSection = useCallback((memoId: number): string | null => {
        const result = createDraftMermaidAttachment(committedRef.current, draftRef.current, memoId);
        if (!result) {
            onMessageRef.current?.(`You can attach up to ${maxAttachmentsPerMemo} items per memo.`);
            return null;
        }
        draftRef.current = result.draft;
        setDraft(result.draft);
        return result.key;
    }, []);

    const addImageToSection = useCallback(async (memoId: number, file: File): Promise<string | null> => {
        if (activeBoardId === null || pendingImageRef.current) {
            return null;
        }
        const pendingImage = Symbol();
        pendingImageRef.current = pendingImage;

        try {
            const prepared = await prepareImageFile(file);
            if (pendingImageRef.current !== pendingImage) {
                return null;
            }
            const result = createDraftImageAttachment(committedRef.current, draftRef.current, memoId, prepared);
            if (!result) {
                onMessageRef.current?.(`You can attach up to ${maxAttachmentsPerMemo} items per memo.`);
                return null;
            }
            draftRef.current = result.draft;
            setDraft(result.draft);
            return result.key;
        } catch (error) {
            if (pendingImageRef.current === pendingImage) {
                onMessageRef.current?.(error instanceof Error ? error.message : "The image could not be added.");
            }
            return null;
        } finally {
            if (pendingImageRef.current === pendingImage) {
                pendingImageRef.current = null;
            }
        }
    }, [activeBoardId]);

    const reorderSection = useCallback((fromIndex: number, toIndex: number) => {
        const next = reorderDraftMemoSections(committedRef.current, draftRef.current, fromIndex, toIndex);
        draftRef.current = next;
        setDraft(next);
    }, []);

    const discardDraft = useCallback(() => {
        pendingImageRef.current = null;
        const empty = createEmptyLinearDraft();
        draftRef.current = empty;
        setDraft(empty);
        setCloseConfirmOpen(false);
    }, []);

    const applyDraft = useCallback(async (): Promise<boolean> => {
        if (pendingImageRef.current) {
            return false;
        }
        const currentSnapshot = committedRef.current;
        const currentDraft = draftRef.current;
        if (!isLinearDraftDirty(currentSnapshot, currentDraft)) {
            return true;
        }
        setApplying(true);
        let cleared = false;
        const clearDraft = () => {
            if (cleared) {
                return;
            }
            cleared = true;
            const empty = createEmptyLinearDraft();
            draftRef.current = empty;
            setDraft(empty);
        };
        try {
            const finalized = applyLinearDraftToSnapshot(currentSnapshot, currentDraft, {
                finalizeIds: true,
            });
            const ok = await onCommitRef.current(finalized, clearDraft);
            if (ok) {
                clearDraft();
            }
            return ok;
        } finally {
            setApplying(false);
        }
    }, []);

    const requestClose = useCallback(() => {
        if (isLinearDraftDirty(committedRef.current, draftRef.current) && canEdit) {
            setCloseConfirmOpen(true);
            return;
        }
        pendingImageRef.current = null;
        onCloseRef.current();
    }, [canEdit]);

    const handleApplyAndClose = useCallback(async () => {
        const ok = await applyDraft();
        if (ok) {
            setCloseConfirmOpen(false);
            onCloseRef.current();
        }
    }, [applyDraft]);

    const handleDiscardAndClose = useCallback(() => {
        discardDraft();
        onCloseRef.current();
    }, [discardDraft]);

    const handleKeepEditing = useCallback(() => {
        setCloseConfirmOpen(false);
    }, []);

    return {
        draft,
        isDirty,
        applying,
        displaySnapshot,
        closeConfirmOpen,
        editMemoHtml,
        editTableSource,
        editMermaidSource,
        editImageLabel,
        addSection,
        addTableToSection,
        addMermaidToSection,
        addImageToSection,
        reorderSection,
        applyDraft,
        discardDraft,
        requestClose,
        handleApplyAndClose,
        handleDiscardAndClose,
        handleKeepEditing,
    };
}
