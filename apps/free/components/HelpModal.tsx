"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import PressableButton from "@meldrift/ui/PressableButton";
import { getHelpShortcut, helpMarkdownUrl } from "@/lib/help";

type HelpModalProps = {
    onClose: () => void;
};

export default function HelpModal({ onClose }: HelpModalProps) {
    const [markdown, setMarkdown] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const shortcut = getHelpShortcut(typeof navigator === "undefined" ? "" : navigator.userAgent);

    useEffect(() => {
        const controller = new AbortController();

        fetch(helpMarkdownUrl, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("The Help document could not be loaded.");
                }
                return response.text();
            })
            .then(setMarkdown)
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setErrorMessage(error instanceof Error ? error.message : "The Help document could not be loaded.");
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return createPortal(
        <>
            <div
                className="fixed inset-0 bg-black/50"
                style={{ zIndex: 60000 }}
                onClick={onClose}
            />
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="help-title"
                className="fixed left-1/2 top-1/2 flex h-[min(52rem,calc(100dvh-2rem))] w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white text-neutral-900 shadow-xl"
                style={{ zIndex: 60001 }}
            >
                <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
                    <div className="flex items-center gap-3">
                        <h2 id="help-title" className="text-base font-bold">Help</h2>
                        <kbd
                            className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-sm font-semibold text-neutral-500"
                            aria-label={shortcut.ariaLabel}
                            title={shortcut.ariaLabel}
                        >
                            {shortcut.label}
                        </kbd>
                    </div>
                    <PressableButton
                        className="border-0 p-1 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                        onClick={onClose}
                        aria-label="Close Help"
                    >
                        <X className="h-4 w-4" />
                    </PressableButton>
                </header>

                <div className="min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-8 sm:py-6">
                    {errorMessage ? (
                        <p className="text-sm font-semibold text-rose-600">{errorMessage}</p>
                    ) : markdown ? (
                        <article className="board-markdown-content">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                            >
                                {markdown}
                            </ReactMarkdown>
                        </article>
                    ) : (
                        <p className="text-sm text-neutral-500">Loading Help...</p>
                    )}
                </div>
            </section>
        </>,
        document.body
    );
}
