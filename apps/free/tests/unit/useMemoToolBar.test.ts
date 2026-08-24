import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMemoToolBar } from "@/hooks/useMemoToolBar";

describe("useMemoToolBar", () => {
    it("offers the full beta memo color palette", () => {
        const { result } = renderHook(() => useMemoToolBar({}));

        expect(result.current.memoColors).toEqual([
            { name: "Yellow", value: "#fffadc" },
            { name: "Pink", value: "#ffe4ec" },
            { name: "Blue", value: "#e0f2fe" },
            { name: "Green", value: "#dcfce7" },
            { name: "Lavender", value: "#ede9fe" },
            { name: "Peach", value: "#ffedd5" },
            { name: "Mint", value: "#ccfbf1" },
            { name: "Gray", value: "#f1f5f9" },
        ]);
    });

    it("keeps color and heading submenus mutually exclusive", () => {
        const { result } = renderHook(() => useMemoToolBar({}));
        act(() => result.current.toggleColorMenu());
        expect(result.current.openMemoColorMenu).toBe(true);
        expect(result.current.openHeadingMenu).toBe(false);

        act(() => result.current.toggleHeadingMenu());
        expect(result.current.openMemoColorMenu).toBe(false);
        expect(result.current.openHeadingMenu).toBe(true);
    });

    it("selects formatting values and closes their submenu", () => {
        const onChangeColor = vi.fn();
        const onHeading = vi.fn();
        const { result } = renderHook(() => useMemoToolBar({ onChangeColor, onHeading }));

        act(() => result.current.toggleColorMenu());
        act(() => result.current.handleColorSelect("#ffe4ec"));
        expect(onChangeColor).toHaveBeenCalledWith("#ffe4ec");
        expect(result.current.openMemoColorMenu).toBe(false);

        act(() => result.current.toggleHeadingMenu());
        act(() => result.current.handleHeadingSelect(3));
        expect(onHeading).toHaveBeenCalledWith(3);
        expect(result.current.openHeadingMenu).toBe(false);
    });

    it("changes tool modes and closes open submenus", () => {
        const { result } = renderHook(() => useMemoToolBar({}));
        act(() => result.current.toggleColorMenu());
        act(() => result.current.openBlockTools());
        expect(result.current.toolMode).toBe("block");
        expect(result.current.openMemoColorMenu).toBe(false);
        act(() => result.current.openFormatTools());
        expect(result.current.toolMode).toBe("format");
        act(() => result.current.openMainTools());
        expect(result.current.toolMode).toBe("main");
    });
});
