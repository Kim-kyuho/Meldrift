"use client";

import { PointerEvent as ReactPointerEvent, useEffect, useImperativeHandle, useRef, Ref } from "react";
import { createEditor } from "@meldrift/markdown-engine";

type Editor = ReturnType<typeof createEditor>;

export type MemoEditorHandle = {
    toggleCodeBlock: () => void;
    toggleBlockQuote: () => void;
    toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
    toggleBold: () => void;
    toggleItalic: () => void;
    toggleStrike: () => void;
    setHorizontalRule: () => void;
    toggleHighlight: () => void;
};

const blockSelector = "p, h1, h2, h3, h4, h5, h6, ul, ol, li, pre, blockquote, hr";

function getSelectionRange(element: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) {
        return null;
    }

    return range;
}

function findSelectionElement(element: HTMLElement, selector: string) {
    const range = getSelectionRange(element);
    if (!range) {
        return null;
    }

    const container = range.startContainer;
    const start = container instanceof Element ? container : container.parentElement;
    const found = start?.closest(selector);
    if (!found || !element.contains(found)) {
        return null;
    }

    return found;
}

function selectRange(range: Range) {
    const selection = window.getSelection();
    if (!selection) {
        return;
    }

    selection.removeAllRanges();
    selection.addRange(range);
}

function placeCaretAtEnd(element: HTMLElement) {
    let container: Node = element;
    while (container.lastChild && !["BR", "HR"].includes(container.lastChild.nodeName)) {
        container = container.lastChild;
    }

    let offset = container.childNodes.length;
    if (container.nodeType === Node.TEXT_NODE) {
        offset = (container as Text).length;
    } else if (container.lastChild) {
        offset -= 1;
    }

    const range = document.createRange();
    range.setStart(container, offset);
    range.collapse(true);
    selectRange(range);
}

function getTextOffset(element: HTMLElement, node: Node, offset: number) {
    const range = document.createRange();
    range.setStart(element, 0);
    range.setEnd(node, offset);
    return range.toString().length;
}

function findTextPosition(element: HTMLElement, textOffset: number): [Node, number] {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = textOffset;
    let lastText: Text | null = null;
    while (walker.nextNode()) {
        const text = walker.currentNode as Text;
        if (remaining <= text.length) {
            return [text, remaining];
        }

        remaining -= text.length;
        lastText = text;
    }

    if (lastText) {
        return [lastText, lastText.length];
    }

    return [element, 0];
}

// 감싼 요소를 없애면 그 요소에 걸린 선택 영역이 풀리므로 글자 위치로 기억했다가 되돌린다.
function keepSelection(element: HTMLElement, change: () => void) {
    const selection = window.getSelection();
    if (!selection?.anchorNode || !selection.focusNode) {
        change();
        return;
    }

    const anchor = getTextOffset(element, selection.anchorNode, selection.anchorOffset);
    const focus = getTextOffset(element, selection.focusNode, selection.focusOffset);

    change();

    const [anchorNode, anchorOffset] = findTextPosition(element, anchor);
    const [focusNode, focusOffset] = findTextPosition(element, focus);
    selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
}

function unwrapElement(target: Element) {
    target.replaceWith(...Array.from(target.childNodes));
}

function unwrapBlockQuote(quote: Element) {
    const hasBlocks = Array.from(quote.children).some((child) => child.matches(blockSelector));
    if (hasBlocks) {
        unwrapElement(quote);
        return;
    }

    const paragraph = document.createElement("p");
    paragraph.append(...Array.from(quote.childNodes));
    quote.replaceWith(paragraph);
}

function unwrapCodeBlock(pre: Element) {
    const source = pre.querySelector("code") ?? pre;
    const paragraph = document.createElement("p");
    paragraph.append(...Array.from(source.childNodes));
    if (!paragraph.hasChildNodes()) {
        paragraph.append(document.createElement("br"));
    }

    pre.replaceWith(paragraph);
}

// 글 끝에 넣은 구분선 뒤에는 문단이 없어서 이어 쓴 글자가 블록 밖에 들어간다.
function addParagraphAfterRule(element: HTMLElement) {
    const range = getSelectionRange(element);
    if (!range || range.startContainer !== element) {
        return false;
    }

    const rule = element.childNodes[range.startOffset - 1];
    if (rule?.nodeName !== "HR" || rule.nextSibling) {
        return false;
    }

    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    rule.after(paragraph);
    range.setStart(paragraph, 0);
    range.collapse(true);
    selectRange(range);
    return true;
}

function wrapSelection(element: HTMLElement, tagName: string) {
    const range = getSelectionRange(element);
    if (!range || range.collapsed || range.cloneContents().querySelector(blockSelector)) {
        return false;
    }

    const wrapper = document.createElement(tagName);
    wrapper.append(range.extractContents());
    range.insertNode(wrapper);
    range.selectNodeContents(wrapper);
    selectRange(range);
    return true;
}

export default function MemoEditor({
    ref,
    content,
    onChange,
}: {
    ref?:  Ref<MemoEditorHandle>;
    content: string;
    onChange: (content: string) => void;
}) {
    const elementRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const lastContentRef = useRef(content);
    const silentRef = useRef(false);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) {
            return;
        }

        // 불러올 때 엔진이 정리한 HTML은 사용자가 고친 내용이 아니므로 변경으로 알리지 않는다.
        silentRef.current = true;
        editorRef.current = createEditor(element, {
            html: lastContentRef.current,
            onChange: (html) => {
                if (silentRef.current) {
                    return;
                }

                lastContentRef.current = html;
                onChangeRef.current(html);
            },
        });
        silentRef.current = false;

        const focusTimer = window.setTimeout(() => {
            element.focus();
            placeCaretAtEnd(element);
        }, 0);

        return () => {
            window.clearTimeout(focusTimer);
            editorRef.current?.destroy();
            editorRef.current = null;
        };
    }, []);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || content === lastContentRef.current) {
            return;
        }

        lastContentRef.current = content;
        silentRef.current = true;
        editor.setHTML(content);
        silentRef.current = false;
    }, [content]);

    const runCommand = (command: string) => {
        elementRef.current?.focus();
        editorRef.current?.exec(command);
    };

    // 엔진 exec에 없는 명령. 브라우저가 input 이벤트를 보내므로 엔진이 변경을 알린다.
    const runBrowserCommand = (command: string, value?: string) => {
        elementRef.current?.focus();
        document.execCommand(command, false, value);
    };

    // 직접 고친 DOM은 input 이벤트가 없으므로 변경을 직접 알린다.
    const changeDocument = (change: (element: HTMLElement) => boolean) => {
        const element = elementRef.current;
        const editor = editorRef.current;
        if (!element || !editor) {
            return;
        }

        element.focus();
        if (!change(element)) {
            return;
        }

        const html = editor.getHTML();
        lastContentRef.current = html;
        onChangeRef.current(html);
    };

    const toggleBlock = (selector: string, unwrap: (block: Element) => void, command: string) => {
        changeDocument((element) => {
            const block = findSelectionElement(element, selector);
            if (!block) {
                runCommand(command);
                return false;
            }

            keepSelection(element, () => unwrap(block));
            return true;
        });
    };

    const toggleInline = (selector: string, wrap: (element: HTMLElement) => boolean) => {
        changeDocument((element) => {
            const inline = findSelectionElement(element, selector);
            if (!inline) {
                return wrap(element);
            }

            keepSelection(element, () => unwrapElement(inline));
            return true;
        });
    };

    useImperativeHandle(ref, () => ({
        toggleCodeBlock: () => {
            toggleBlock("pre", unwrapCodeBlock, "pre");
        },
        toggleBlockQuote: () => {
            toggleBlock("blockquote", unwrapBlockQuote, "blockquote");
        },
        toggleHeading: (level) => {
            const tagName = `h${level}`;
            const element = elementRef.current;
            if (element && findSelectionElement(element, tagName)) {
                runCommand("p");
                return;
            }

            if (level <= 3) {
                runCommand(tagName);
                return;
            }

            runBrowserCommand("formatBlock", tagName);
        },
        toggleBold: () => {
            runCommand("bold");
        },
        toggleItalic: () => {
            runCommand("italic");
        },
        toggleStrike: () => {
            toggleInline("del, s, strike", () => {
                runCommand("strikeThrough");
                return false;
            });
        },
        setHorizontalRule: () => {
            runBrowserCommand("insertHorizontalRule");
            changeDocument(addParagraphAfterRule);
        },
        toggleHighlight: () => {
            toggleInline("mark", (element) => wrapSelection(element, "mark"));
        },
    }));

    const handleEditorPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        const element = elementRef.current;
        if (!element || (event.pointerType !== "touch" && event.pointerType !== "mouse")) {
            return;
        }

        if (document.activeElement !== element) {
            element.focus();
            placeCaretAtEnd(element);
        }
    };

    return (
        <div
            ref={elementRef}
            className="memo-editor-content"
            onPointerUp={handleEditorPointerUp}
        />
    );
}
