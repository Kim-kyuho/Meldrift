"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
    Bold,
    Check,
    Code2,
    Highlighter,
    Italic,
    Minus,
    Quote,
    Strikethrough,
} from "lucide-react";
import MemoEditor, { type MemoEditorHandle } from "../memo/MemoEditor";

type MarkdownMemoBlockProps = {
    memoId: number;
    html: string;
    canEdit: boolean;
    active: boolean;
    onActivate: () => void;
    onDeactivate: () => void;
    onChange: (nextHtml: string) => void;
    onNavigatePrev?: () => void;
    onNavigateNext?: () => void;
};

function isCaretAtEdge(container: HTMLElement, edge: "start" | "end"): boolean {
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) {
        return false;
    }
    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer)) {
        return false;
    }
    const probe = document.createRange();
    probe.selectNodeContents(container);
    if (edge === "start") {
        probe.setEnd(range.startContainer, range.startOffset);
    } else {
        probe.setStart(range.endContainer, range.endOffset);
    }
    return probe.toString().replace(/[\u200b\ufeff]/g, "").length === 0;
}

// Recognize blank memo markup without transforming the HTML.
const emptyMemoMarkup = /^(?:[\s\u200b]|&nbsp;|&#(?:0*160|x0*a0);|<[^>]*>)*$/i;

export default function MarkdownMemoBlock({
    memoId,
    html,
    canEdit,
    active,
    onActivate,
    onDeactivate,
    onChange,
    onNavigatePrev,
    onNavigateNext,
}: MarkdownMemoBlockProps) {
    const editorRef = useRef<MemoEditorHandle>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (active && canEdit) {
            wrapperRef.current?.scrollIntoView?.({ block: "nearest" });
        }
    }, [active, canEdit]);

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            onDeactivate();
            return;
        }
        const editable = wrapperRef.current?.querySelector<HTMLElement>(".memo-editor-content");
        if (!editable) {
            return;
        }
        if (event.key === "ArrowUp" && onNavigatePrev && isCaretAtEdge(editable, "start")) {
            event.preventDefault();
            onNavigatePrev();
        } else if (event.key === "ArrowDown" && onNavigateNext && isCaretAtEdge(editable, "end")) {
            event.preventDefault();
            onNavigateNext();
        }
    };

    const toolbarButtonClass =
        "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950";

    if (active && canEdit) {
        return (
            <div
                ref={wrapperRef}
                data-linear-memo-editing={memoId}
                className="linear-markdown-memo-editor rounded-lg border border-sky-300/90 bg-white px-3 py-2 ring-2 ring-sky-100"
                onKeyDown={handleKeyDown}
            >
                <div
                    role="toolbar"
                    aria-label="Markdown formatting"
                    className="mb-2 flex flex-wrap items-center gap-0.5 border-b border-neutral-100 pb-1.5"
                    onMouseDown={(event) => event.preventDefault()}
                >
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleHeading(1)} aria-label="Heading 1">H1</button>
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleHeading(2)} aria-label="Heading 2">H2</button>
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleHeading(3)} aria-label="Heading 3">H3</button>
                    <span className="mx-1 h-4 w-px bg-neutral-200" aria-hidden="true" />
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleBold()} aria-label="Bold"><Bold className="h-3.5 w-3.5" /></button>
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleItalic()} aria-label="Italic"><Italic className="h-3.5 w-3.5" /></button>
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleStrike()} aria-label="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></button>
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleHighlight()} aria-label="Highlight"><Highlighter className="h-3.5 w-3.5" /></button>
                    <span className="mx-1 h-4 w-px bg-neutral-200" aria-hidden="true" />
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleCodeBlock()} aria-label="Code block"><Code2 className="h-3.5 w-3.5" /></button>
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.toggleBlockQuote()} aria-label="Blockquote"><Quote className="h-3.5 w-3.5" /></button>
                    <button type="button" className={toolbarButtonClass} onClick={() => editorRef.current?.setHorizontalRule()} aria-label="Horizontal rule"><Minus className="h-3.5 w-3.5" /></button>
                    <button
                        type="button"
                        className="ml-auto flex h-7 items-center gap-1 rounded-md bg-neutral-900 px-2 text-xs font-medium text-white hover:bg-neutral-800"
                        onClick={onDeactivate}
                        aria-label="Finish editing section"
                        title="Done (Esc) · Next object: Alt+Enter or ⌘+Enter"
                    >
                        <Check className="h-3.5 w-3.5" />
                        Done
                    </button>
                </div>
                <MemoEditor
                    ref={editorRef}
                    content={html}
                    onChange={onChange}
                />
            </div>
        );
    }

    const empty = emptyMemoMarkup.test(html);

    return (
        <div
            data-linear-memo={memoId}
            role={canEdit ? "button" : undefined}
            tabIndex={canEdit ? 0 : undefined}
            aria-label={canEdit ? `Edit section ${memoId}` : undefined}
            onClick={canEdit ? onActivate : undefined}
            onKeyDown={canEdit ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onActivate();
                }
            } : undefined}
            className={`linear-markdown-memo-editor rounded-lg px-2 py-1 transition-colors ${
                canEdit ? "cursor-text hover:bg-neutral-50/90" : ""
            }`}
        >
            {empty ? (
                <p className="py-1 text-sm italic text-neutral-400">
                    {canEdit ? "Click to write Markdown..." : ""}
                </p>
            ) : (
                <div
                    className="memo-editor-content"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )}
        </div>
    );
}
