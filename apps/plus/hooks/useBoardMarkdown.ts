import { useEffect, useState } from "react";

type MarkdownResponse = {
    ok: boolean;
    markdown?: string;
    message?: string;
};

export function useBoardMarkdown(boardId: number) {
    const [markdown, setMarkdown] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const handleMarkdownDownload = () => {
        const file = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
        const fileUrl = URL.createObjectURL(file);
        const downloadLink = document.createElement("a");

        downloadLink.href = fileUrl;
        downloadLink.download = `board-${boardId}.md`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        URL.revokeObjectURL(fileUrl);
    };

    useEffect(() => {
        const controller = new AbortController();

        const loadMarkdown = async () => {
            try {
                const response = await fetch(`/api/boards/${boardId}/markdown`, {
                    signal: controller.signal,
                });
                const data = await response.json() as MarkdownResponse;

                if (!response.ok || !data.ok) {
                    setErrorMessage(data.message ?? "Markdown document could not be generated.");
                    return;
                }

                setMarkdown(data.markdown ?? "");
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }

                setErrorMessage("Markdown document could not be generated.");
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        void loadMarkdown();

        return () => controller.abort();
    }, [boardId]);

    // Mermaid 코드 블록을 기준으로 Markdown을 분리하고, 코드 펜스를 제외한 Mermaid 소스만 캡처하여 렌더링한다.
    const markdownSections = markdown.split(/```mermaid\s*\r?\n([\s\S]*?)```/g);

    return {
        markdown,
        markdownSections,
        errorMessage,
        loading,
        handleMarkdownDownload,
    };
}
