"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Keyboard, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import MermaidDiagramView from "@meldrift/ui/MermaidDiagramView";
import { splitMermaidSections } from "@meldrift/ui/mermaid-sections";
import PressableButton from "@meldrift/ui/PressableButton";
import { getHelpShortcut, type BoardGuide } from "./board-guide";

type HelpTab = "introduce" | "short-cut";

type HelpModalProps = {
    guide: BoardGuide;
    onClose: () => void;
};

const HELP_TABS: Array<{
    id: HelpTab;
    label: string;
    icon: typeof BookOpen;
}> = [
    {
        id: "introduce",
        label: "Introduce",
        icon: BookOpen,
    },
    {
        id: "short-cut",
        label: "Short-cut",
        icon: Keyboard,
    },
];

const helpTabUrl = (guide: BoardGuide, tab: HelpTab) =>
    tab === "introduce" ? guide.helpMarkdownUrl : guide.helpShortcutsUrl;

export default function HelpModal({ guide, onClose }: HelpModalProps) {
    const [activeTab, setActiveTab] = useState<HelpTab>("introduce");
    const [docs, setDocs] = useState<Partial<Record<HelpTab, string>>>({});
    const [errors, setErrors] = useState<Partial<Record<HelpTab, string>>>({});
    const contentRef = useRef<HTMLDivElement | null>(null);
    const shortcut = getHelpShortcut(typeof navigator === "undefined" ? "" : navigator.userAgent);

    const activeTabUrl = helpTabUrl(guide, activeTab);
    const activeMarkdown = docs[activeTab] ?? "";
    const activeError = errors[activeTab] ?? "";

    useEffect(() => {
        if (docs[activeTab] !== undefined || errors[activeTab] !== undefined) {
            return;
        }

        const controller = new AbortController();
        const targetTab = activeTab;
        const targetUrl = activeTabUrl;

        fetch(targetUrl, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("The Help document could not be loaded.");
                }
                return response.text();
            })
            .then((text) => {
                setDocs((prev) => ({ ...prev, [targetTab]: text }));
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
                const message = error instanceof Error
                    ? error.message
                    : "The Help document could not be loaded.";
                setErrors((prev) => ({ ...prev, [targetTab]: message }));
            });

        return () => controller.abort();
    }, [activeTab, activeTabUrl, docs, errors]);

    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const markdownSections = activeMarkdown ? splitMermaidSections(activeMarkdown) : [];

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
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 id="help-title" className="text-base font-bold">Help</h2>
                        <kbd
                            className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-sm font-semibold text-neutral-500"
                            aria-label={shortcut.ariaLabel}
                            title={shortcut.ariaLabel}
                        >
                            {shortcut.label}
                        </kbd>
                        <div
                            role="tablist"
                            aria-label="Help sections"
                            className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 p-1"
                        >
                            {HELP_TABS.map((tab) => {
                                const selected = tab.id === activeTab;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        id={`help-tab-${tab.id}`}
                                        aria-selected={selected}
                                        aria-controls={`help-panel-${tab.id}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition ${
                                            selected
                                                ? "bg-white text-neutral-900 shadow-xs"
                                                : "text-neutral-500 hover:text-neutral-800"
                                        }`}
                                    >
                                        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <PressableButton
                        className="border-0 p-1 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                        onClick={onClose}
                        aria-label="Close Help"
                    >
                        <X className="h-4 w-4" />
                    </PressableButton>
                </header>

                <div
                    ref={contentRef}
                    role="tabpanel"
                    id={`help-panel-${activeTab}`}
                    aria-labelledby={`help-tab-${activeTab}`}
                    className="min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-8 sm:py-6"
                >
                    {activeError ? (
                        <p className="text-sm font-semibold text-rose-600">{activeError}</p>
                    ) : activeMarkdown ? (
                        <article className="board-markdown-content">
                            {markdownSections.map((section, index) =>
                                index % 2 === 1 ? (
                                    <MermaidDiagramView
                                        key={`mermaid-${activeTab}-${index}`}
                                        source={section.trim()}
                                        className="mermaid-diagram-view h-80 w-full"
                                    />
                                ) : (
                                    <ReactMarkdown
                                        key={`markdown-${activeTab}-${index}`}
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw, rehypeSanitize]}
                                    >
                                        {section}
                                    </ReactMarkdown>
                                )
                            )}
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
