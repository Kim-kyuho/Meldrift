"use client";

import { useEffect, useRef, useState } from "react";
import {
    importMarkdownToBoard,
    maxMarkdownImportBytes,
    type MarkdownImportResult,
} from "@meldrift/board-data/board-markdown-import";
import type { BoardInfo, BoardSnapshot } from "@meldrift/board-data/board-state";
import ConfirmDialog from "../../shared/ConfirmDialog";

export type BoardMarkdownImporterProps = {
    file: File | null;
    board: BoardInfo;
    hasExistingContent: boolean;
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
    onCommit: (snapshot: BoardSnapshot) => void;
    onMessage: (message: string) => void;
    onClose: () => void;
};

const bytesPerMiB = 1024 * 1024;

function formatImportSummary(result: MarkdownImportResult): string {
    const parts = [`${result.stats.memos} memo${result.stats.memos === 1 ? "" : "s"}`];
    if (result.stats.tables > 0) {
        parts.push(`${result.stats.tables} table${result.stats.tables === 1 ? "" : "s"}`);
    }
    if (result.stats.mermaids > 0) {
        parts.push(`${result.stats.mermaids} diagram${result.stats.mermaids === 1 ? "" : "s"}`);
    }
    return parts.join(", ");
}

function droppedSectionsMessage(droppedSections: number): string {
    if (droppedSections <= 0) {
        return "";
    }
    return `${droppedSections} section${droppedSections === 1 ? "" : "s"} did not fit on the board and could not be placed.`;
}

export default function BoardMarkdownImporter({
    file,
    board,
    hasExistingContent,
    disabled,
    onBusyChange,
    onCommit,
    onMessage,
    onClose,
}: BoardMarkdownImporterProps) {
    const [pendingResult, setPendingResult] = useState<MarkdownImportResult | null>(null);
    const latest = useRef({
        board,
        hasExistingContent,
        disabled,
        onBusyChange,
        onCommit,
        onMessage,
        onClose,
    });

    useEffect(() => {
        latest.current = {
            board,
            hasExistingContent,
            disabled,
            onBusyChange,
            onCommit,
            onMessage,
            onClose,
        };
    });

    useEffect(() => {
        if (!file) {
            return;
        }
        if (latest.current.disabled) {
            latest.current.onClose();
            return;
        }
        if (file.size > maxMarkdownImportBytes) {
            const limit = Math.round(maxMarkdownImportBytes / bytesPerMiB);
            latest.current.onMessage(`The Markdown file must be ${limit} MiB or smaller.`);
            latest.current.onClose();
            return;
        }

        let cancelled = false;
        latest.current.onBusyChange(true);

        const processFile = async () => {
            try {
                const buffer = await file.arrayBuffer();
                if (cancelled || latest.current.disabled) {
                    if (!cancelled) {
                        latest.current.onClose();
                    }
                    return;
                }
                const text = new TextDecoder("utf-8").decode(buffer);
                const result = importMarkdownToBoard(text, latest.current.board);
                if (cancelled || latest.current.disabled) {
                    if (!cancelled) {
                        latest.current.onClose();
                    }
                    return;
                }
                if (!latest.current.hasExistingContent) {
                    latest.current.onMessage(droppedSectionsMessage(result.droppedSections));
                    latest.current.onCommit(result.snapshot);
                    latest.current.onClose();
                    return;
                }
                setPendingResult(result);
            } catch (error) {
                if (!cancelled) {
                    latest.current.onMessage(
                        error instanceof Error && error.message
                            ? error.message
                            : "The Markdown file could not be imported.",
                    );
                    latest.current.onClose();
                }
            } finally {
                latest.current.onBusyChange(false);
            }
        };

        void processFile();

        return () => {
            cancelled = true;
            latest.current.onBusyChange(false);
        };
    }, [file]);

    if (!file || !pendingResult) {
        return null;
    }

    const handleCancel = () => {
        setPendingResult(null);
        onClose();
    };

    const handleConfirm = () => {
        const result = pendingResult;
        setPendingResult(null);
        if (disabled) {
            onClose();
            return;
        }
        onMessage(droppedSectionsMessage(result.droppedSections));
        onCommit(result.snapshot);
        onClose();
    };

    return (
        <ConfirmDialog
            title="Import Markdown?"
            message={`Importing this Markdown file will replace the current board contents (${formatImportSummary(pendingResult)}). You can undo this change until you reload the page.`}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );
}
