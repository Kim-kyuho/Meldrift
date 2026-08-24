"use client";

import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

import PressableButton from "@/components/PressableButton";
import { useBoardMarkdown } from "@/hooks/useBoardMarkdown";
import { useMermaidRenderer } from "@/hooks/useMermaidRenderer";

type BoardMarkdownViewProps = {
    boardId: number;
    onClose: () => void;
};

function MarkdownMermaid({ source, diagramId }: { source: string; diagramId: number }) {
    const { svg, renderError } = useMermaidRenderer({
        source,
        mermaidId: diagramId,
    });

    if (renderError) {
        return (
            <pre className="whitespace-pre-wrap rounded-md bg-rose-50 p-3 text-xs text-rose-700">
                {renderError}
            </pre>
        );
    }

    if (!svg) {
        return <p className="text-sm text-neutral-400">Rendering Mermaid diagram...</p>;
    }

    return (
        <div
            className="mermaid-rendered h-80 w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

export default function BoardMarkdownView({ boardId, onClose }: BoardMarkdownViewProps) {
    const {
        markdown,
        markdownSections,
        errorMessage,
        loading,
        handleMarkdownDownload,
    } = useBoardMarkdown(boardId);

    return createPortal(
        <>
            <div
                className="fixed inset-0 bg-black/50"
                style={{ zIndex: 60000 }}
                onClick={onClose}
            />
            <section
                className="fixed left-1/2 top-1/2 flex h-[min(52rem,calc(100dvh-2rem))] w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white text-neutral-900 shadow-xl"
                style={{ zIndex: 60001 }}
                aria-label="Compiled Markdown document"
            >
                <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
                    <h2 className="text-base font-bold">Compiled Markdown</h2>
                    <PressableButton
                        className="p-1"
                        onClick={onClose}
                        aria-label="Close Markdown view"
                    >
                        <X className="h-4 w-4" />
                    </PressableButton>
                </header>

                <div className="relative min-h-0 flex-1">
                    {markdown && !loading && !errorMessage && (
                        <PressableButton
                            className="absolute right-5 top-4 z-10 rounded-full bg-white p-3 shadow-md sm:right-8 sm:top-6"
                            onClick={handleMarkdownDownload}
                            aria-label="Download Markdown"
                            title="Download Markdown"
                        >
                            <Download className="h-4 w-4" />
                        </PressableButton>
                    )}
                    <div className="h-full overflow-auto px-5 py-4 sm:px-8 sm:py-6">
                        {loading ? (
                            <p className="text-sm text-neutral-500">Compiling Markdown...</p>
                        ) : errorMessage ? (
                            <p className="text-sm font-semibold text-rose-600">{errorMessage}</p>
                        ) : markdown ? (
                            <article className="board-markdown-content">
                                {markdownSections.map((section, index) =>
                                    index % 2 === 1 ? (
                                        <MarkdownMermaid
                                            key={`mermaid-${index}`}
                                            source={section.trim()}
                                            diagramId={index}
                                        />
                                    ) : (
                                        <ReactMarkdown
                                            key={`markdown-${index}`}
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw, rehypeSanitize]}
                                        >
                                            {section}
                                        </ReactMarkdown>
                                    )
                                )}
                            </article>
                        ) : (
                            <p className="text-sm text-neutral-500">No memo content exists.</p>
                        )}
                    </div>
                </div>
            </section>
        </>,
        document.body
    );
}
