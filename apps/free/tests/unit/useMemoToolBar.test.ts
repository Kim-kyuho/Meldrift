import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMemoToolBar } from "@meldrift/ui/useMemoToolBar";

describe("useMemoToolBar 동작", () => {
    it("베타 메모 색상 팔레트를 모두 제공한다", () => {
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

    it("색상·제목 하위 메뉴가 동시에 열리지 않게 한다", () => {
        const { result } = renderHook(() => useMemoToolBar({}));
        act(() => result.current.toggleColorMenu());
        expect(result.current.openMemoColorMenu).toBe(true);
        expect(result.current.openHeadingMenu).toBe(false);

        act(() => result.current.toggleHeadingMenu());
        expect(result.current.openMemoColorMenu).toBe(false);
        expect(result.current.openHeadingMenu).toBe(true);
    });

    it("서식 값을 선택하고 해당 하위 메뉴를 닫는다", () => {
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

    it("도구 모드를 변경하고 열린 하위 메뉴를 닫는다", () => {
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
