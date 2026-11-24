import createDOMPurify, { type Config } from "dompurify";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import type { ChangeRequest } from "@meldrift/board-data/change-request";

const allowedMemoMarkup: Config = {
    ALLOWED_TAGS: [
        "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "hr", "br",
        "strong", "b", "em", "i", "del", "s", "strike", "mark", "code", "u", "small", "sup", "sub", "kbd",
        "ruby", "rt", "span", "a", "input", "nav", "aside", "section",
    ],
    ALLOWED_ATTR: ["href", "title", "aria-label", "start", "reversed", "type", "checked", "disabled", "id", "class", "style"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
};

const memoClass = /^(?:language-[\w#+.-]+|callout callout-(?:note|tip|important|warning|caution)|callout-title|footnote-backref|footnotes|table-of-contents|toc-level-[1-6])$/;
const inlineDeclaration = /^(?:(?:color|background(?:-color)?)\s*:\s*(?:#[\da-f]{3,8}|[a-z]{1,20})|font-size\s*:\s*\d{1,3}(?:\.\d{1,2})?(?:px|em|rem|%))$/i;
let memoPurifier: ReturnType<typeof createDOMPurify> | undefined;

function getMemoPurifier() {
    if (memoPurifier) {
        return memoPurifier;
    }
    const purifier = createDOMPurify(window);
    purifier.addHook("uponSanitizeAttribute", (element, attribute) => {
        if (attribute.attrName === "class" && !memoClass.test(attribute.attrValue)) {
            attribute.keepAttr = false;
        }
        if (attribute.attrName === "style") {
            const declarations = attribute.attrValue.split(";").map((part) => part.trim()).filter(Boolean);
            if (element.nodeName !== "SPAN" || !declarations.every((part) => inlineDeclaration.test(part))) {
                attribute.keepAttr = false;
            }
        }
    });
    purifier.addHook("afterSanitizeAttributes", (element) => {
        if (element.nodeName === "INPUT" && element.getAttribute("type") !== "checkbox") {
            element.remove();
        }
    });
    memoPurifier = purifier;
    return purifier;
}

export function sanitizeSharedMemo(content: string) {
    return getMemoPurifier().sanitize(content, allowedMemoMarkup);
}

export function requireShareableMemos(memos: BoardSnapshot["memos"]) {
    const template = document.createElement("template");
    for (const memo of memos) {
        template.innerHTML = memo.content;
        if (sanitizeSharedMemo(template.innerHTML) !== template.innerHTML) {
            throw new Error("Remove unsupported formatting from the board's memos before sharing.");
        }
    }
}

export function sanitizeSharedChange(change: ChangeRequest): ChangeRequest {
    const operations = change.operations.map((operation) => {
        if (operation.type !== "memo" || typeof operation.changes.content !== "string") {
            return operation;
        }
        return { ...operation, changes: { ...operation.changes, content: sanitizeSharedMemo(operation.changes.content) } };
    });
    return { ...change, operations };
}
