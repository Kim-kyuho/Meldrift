import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useBoardPointerActive } from "../src/features/board/useBoardPointerActive";

function Harness() {
    const viewport = useRef<HTMLDivElement | null>(null);
    const active = useBoardPointerActive(viewport);
    return <>
        <div ref={viewport} data-testid="board">
            <div data-testid="drawing" onPointerUp={(event) => event.stopPropagation()} />
        </div>
        <div data-testid="outside" />
        <output>{String(active)}</output>
    </>;
}

describe("useBoardPointerActive", () => {
    it("ends a drawing gesture even when its layer stops propagation", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("drawing"), { pointerId: 1 });
        expect(screen.getByText("true")).toBeInTheDocument();
        fireEvent.pointerUp(screen.getByTestId("drawing"), { pointerId: 1 });
        expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("tracks multiple pointers until all have ended, including an outside release", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 1 });
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 2 });
        fireEvent.pointerUp(screen.getByTestId("outside"), { pointerId: 1 });
        expect(screen.getByText("true")).toBeInTheDocument();
        fireEvent.pointerCancel(window, { pointerId: 2 });
        expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("handles Pencil hover without mistaking pressure for a lifted pen", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 1, pointerType: "pen" });
        fireEvent.pointerMove(window, { pointerId: 1, pointerType: "pen", buttons: 0, pressure: 0.5 });
        expect(screen.getByText("true")).toBeInTheDocument();
        fireEvent.pointerMove(window, { pointerId: 1, pointerType: "pen", buttons: 0, pressure: 0 });
        expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("ignores toolbar presses and clears active input on blur", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("outside"), { pointerId: 1 });
        expect(screen.getByText("false")).toBeInTheDocument();
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 2 });
        fireEvent.blur(window);
        expect(screen.getByText("false")).toBeInTheDocument();
    });
});
