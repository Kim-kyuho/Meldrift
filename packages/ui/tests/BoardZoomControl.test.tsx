import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardZoomControl from "../src/features/board/BoardZoomControl";

describe("BoardZoomControl 동작", () => {
    it("줌 비율 텍스트의 선택을 막는다", () => {
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
