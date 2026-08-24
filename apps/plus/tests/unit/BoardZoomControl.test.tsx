import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardZoomControl from "@/components/BoardZoomControl";

describe("BoardZoomControl", () => {
    it("blocks selection of the zoom percentage", () => {
        const { container } = render(
            <BoardZoomControl boardZoom={0.75} setBoardZoom={vi.fn()} />
        );
        const control = container.querySelector(".board-toolbar") as HTMLElement;

        expect(control.textContent).toContain("75%");
        // 선택 가능하면 iPad에서 이 숫자가 드래그된다
        expect(control.style.userSelect).toBe("none");
        expect(control.style.webkitUserSelect).toBe("none");
    });
});
