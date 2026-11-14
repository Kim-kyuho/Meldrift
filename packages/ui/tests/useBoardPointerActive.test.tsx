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

describe("useBoardPointerActive 동작", () => {
    it("레이어가 전파를 막아도 드로잉 제스처를 종료한다", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("drawing"), { pointerId: 1 });
        expect(screen.getByText("true")).toBeInTheDocument();
        fireEvent.pointerUp(screen.getByTestId("drawing"), { pointerId: 1 });
        expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("영역 밖에서 놓은 경우를 포함해 모든 포인터가 끝날 때까지 추적한다", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 1 });
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 2 });
        fireEvent.pointerUp(screen.getByTestId("outside"), { pointerId: 1 });
        expect(screen.getByText("true")).toBeInTheDocument();
        fireEvent.pointerCancel(window, { pointerId: 2 });
        expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("Pencil의 공중 이동과 실제 접촉을 압력으로 구분한다", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 1, pointerType: "pen" });
        fireEvent.pointerMove(window, { pointerId: 1, pointerType: "pen", buttons: 0, pressure: 0.5 });
        expect(screen.getByText("true")).toBeInTheDocument();
        fireEvent.pointerMove(window, { pointerId: 1, pointerType: "pen", buttons: 0, pressure: 0 });
        expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("툴바 누르기는 무시하고 초점을 잃으면 활성 입력을 지운다", () => {
        render(<Harness />);
        fireEvent.pointerDown(screen.getByTestId("outside"), { pointerId: 1 });
        expect(screen.getByText("false")).toBeInTheDocument();
        fireEvent.pointerDown(screen.getByTestId("board"), { pointerId: 2 });
        fireEvent.blur(window);
        expect(screen.getByText("false")).toBeInTheDocument();
    });
});
