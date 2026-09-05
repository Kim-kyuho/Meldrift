"use client";

import SharedBoardMarkdownView from "@meldrift/ui/BoardMarkdownView";
import { useBoardMarkdown } from "@/hooks/useBoardMarkdown";

type BoardMarkdownViewProps = {
    boardId: number;
    onClose: () => void;
};

export default function BoardMarkdownView({ boardId, onClose }: BoardMarkdownViewProps) {
    const {
        markdown,
        errorMessage,
        loading,
        handleMarkdownDownload,
    } = useBoardMarkdown(boardId);

    return (
        <SharedBoardMarkdownView
            markdown={markdown}
            errorMessage={errorMessage}
            loading={loading}
            onDownload={handleMarkdownDownload}
            onClose={onClose}
        />
    );
}
