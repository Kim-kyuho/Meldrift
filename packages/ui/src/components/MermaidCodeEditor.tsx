"use client";

import { useEffect, useRef } from "react";
import {
    autocompletion,
    completionKeymap,
    startCompletion,
    type Completion,
    type CompletionContext,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap, tooltips } from "@codemirror/view";
import { getMermaidCompletions } from "@meldrift/core/mermaid-language";

type MermaidCodeEditorProps = {
    value: string;
    onChange: (value: string) => void;
};

/** 자동완성 목록은 다섯 줄까지만 보이고 나머지는 스크롤로 본다. */
const completionRowHeight = 28;
const completionRowPadding = 4;
const completionVisibleRows = 5;

const completionType: Record<string, string> = {
    keyword: "keyword",
    node: "variable",
    relation: "text",
    symbol: "variable",
    snippet: "text",
};

const mermaidCompletionSource = (context: CompletionContext) => {
    const source = context.state.doc.toString();
    const result = getMermaidCompletions(source, context.pos);

    if (!result || (result.from === context.pos && !context.explicit && result.options.length === 0)) {
        return null;
    }

    const options: Completion[] = result.options.map((option) => ({
        label: option.label,
        detail: option.detail,
        type: completionType[option.kind],
        apply: (view, _completion, from, to) => {
            view.dispatch({
                changes: { from, to, insert: option.apply },
                selection: { anchor: from + option.apply.length },
            });

            if (option.kind === "node" || option.kind === "relation") {
                queueMicrotask(() => startCompletion(view));
            }
        },
    }));

    return {
        from: result.from,
        options,
        validFor: /^[\w@-]*$/,
    };
};

const mermaidEditorTheme = EditorView.theme({
    "&": {
        height: "100%",
        backgroundColor: "#fafafa",
        color: "#171717",
        fontSize: "16px",
    },
    ".cm-scroller": {
        overflow: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    ".cm-content": {
        minHeight: "100%",
        padding: "8px 10px",
        caretColor: "#171717",
    },
    ".cm-line": {
        padding: "0",
    },
    ".cm-focused": {
        outline: "none",
    },
    ".cm-cursor": {
        borderLeftColor: "#171717",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "#bae6fd",
    },
    ".cm-tooltip-autocomplete": {
        border: "0",
        borderRadius: "6px",
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.16)",
        overflow: "hidden",
    },
    ".cm-tooltip-autocomplete > ul": {
        // 줄 높이의 배수로 잘라야 여섯 번째 줄이 반쯤 걸쳐 보이지 않는다.
        maxHeight: `${completionRowHeight * completionVisibleRows}px`,
        overflowY: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    ".cm-tooltip-autocomplete > ul > li": {
        // 팝업은 document.body에 붙어 에디터의 글자 크기를 물려받지 못하므로 줄 높이를 직접 고정한다.
        padding: `${completionRowPadding}px 8px`,
        lineHeight: `${completionRowHeight - completionRowPadding * 2}px`,
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "#e0f2fe",
        color: "#171717",
    },
});

export default function MermaidCodeEditor({ value, onChange }: MermaidCodeEditorProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    // 에디터는 한 번만 만들므로 첫 문서만 여기서 읽고, 이후 반영은 아래 동기화 이펙트가 맡는다.
    const initialValueRef = useRef(value);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!containerRef.current) return;

        const editor = new EditorView({
            parent: containerRef.current,
            state: EditorState.create({
                doc: initialValueRef.current,
                extensions: [
                    history(),
                    drawSelection(),
                    EditorView.lineWrapping,
                    keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
                    autocompletion({
                        override: [mermaidCompletionSource],
                        activateOnTyping: true,
                        closeOnBlur: true,
                    }),
                    tooltips({ parent: document.body }),
                    mermaidEditorTheme,
                    EditorView.contentAttributes.of({
                        "aria-label": "Mermaid source",
                        spellcheck: "false",
                    }),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            onChangeRef.current(update.state.doc.toString());
                        }
                    }),
                ],
            }),
        });

        editorRef.current = editor;

        return () => {
            editor.destroy();
            editorRef.current = null;
        };
    }, []);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || editor.state.doc.toString() === value) return;

        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: value },
        });
    }, [value]);

    return <div ref={containerRef} className="min-h-0 min-w-0 flex-1 overflow-hidden" />;
}
