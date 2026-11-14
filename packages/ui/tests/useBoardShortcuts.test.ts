import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardShortcuts } from "../src/features/board/useBoardShortcuts";

describe("useBoardShortcuts 동작", () => {
    it.each(["1", "2", "m", "i", "t", "d"] as const)("%s 키에 해당하는 동작을 실행한다", (key) => {
        const action = vi.fn();
        renderHook(() => useBoardShortcuts({ enabled: true, actions: { [key]: action } }));

        expect(fireEvent.keyDown(document, { key })).toBe(false);
        expect(action).toHaveBeenCalledOnce();
    });

    it.each([
        { repeat: true }, { isComposing: true }, { keyCode: 229 },
        { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    ])("길게 누른 키·조합 입력·수정키 조합을 무시한다: %j", (flags) => {
        const action = vi.fn();
        renderHook(() => useBoardShortcuts({ enabled: true, actions: { m: action } }));
        fireEvent.keyDown(document, { key: "m", ...flags });
        expect(action).not.toHaveBeenCalled();
    });

    it.each(["input", "textarea", "select", "contenteditable", "codemirror"])("%s 입력 중에는 단축키를 무시한다", (kind) => {
        const action = vi.fn();
        renderHook(() => useBoardShortcuts({ enabled: true, actions: { m: action } }));
        const input = document.createElement(kind === "contenteditable" || kind === "codemirror" ? "div" : kind);
        input.tabIndex = 0;
        if (kind === "contenteditable") {
            input.setAttribute("contenteditable", "true");
        }
        if (kind === "codemirror") {
            input.className = "cm-editor";
        }
        const child = document.createElement("span");
        input.append(child);
        document.body.append(input);
        try {
            fireEvent.keyDown(child, { key: "m" });
            input.focus();
            fireEvent.keyDown(document, { key: "m" });
            expect(action).not.toHaveBeenCalled();
        } finally {
            input.remove();
        }
    });

    it.each(["modal", "dialog"])("%s 창이 열려 있으면 뒤쪽에서 동작하지 않는다", (kind) => {
        const action = vi.fn();
        renderHook(() => useBoardShortcuts({ enabled: true, actions: { m: action } }));
        const modal = document.createElement(kind === "dialog" ? "dialog" : "div");
        modal.setAttribute(kind === "dialog" ? "open" : "aria-modal", "true");
        document.body.append(modal);
        try {
            fireEvent.keyDown(document, { key: "m" });
            expect(action).not.toHaveBeenCalled();
        } finally {
            modal.remove();
        }
    });

    it("비활성·사용 불가·알 수 없는 키와 이미 처리된 키를 무시한다", () => {
        const action = vi.fn();
        const { rerender } = renderHook(({ enabled }) => useBoardShortcuts({ enabled, actions: { m: action } }), {
            initialProps: { enabled: false },
        });
        fireEvent.keyDown(document, { key: "m" });
        rerender({ enabled: true });
        expect(fireEvent.keyDown(document, { key: "i" })).toBe(true);
        expect(fireEvent.keyDown(document, { key: "x" })).toBe(true);
        const event = new KeyboardEvent("keydown", { key: "m", cancelable: true });
        event.preventDefault();
        document.dispatchEvent(event);
        expect(action).not.toHaveBeenCalled();
    });

    it("최신 동작을 사용하고 언마운트 시 리스너를 제거한다", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender, unmount } = renderHook(({ action }) => useBoardShortcuts({ enabled: true, actions: { "1": action } }), {
            initialProps: { action: first },
        });
        fireEvent.keyDown(document, { key: "1" });
        rerender({ action: second });
        fireEvent.keyDown(document, { key: "1" });
        unmount();
        fireEvent.keyDown(document, { key: "1" });
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });
});
