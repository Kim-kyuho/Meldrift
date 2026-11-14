import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import TableCard from "../src/features/table/TableCard";
import { getTableCardMinHeight } from "../src/features/table/table-layout";

vi.mock("react-rnd", () => ({
    Rnd: ({ children, minHeight, size }: { children: ReactNode; minHeight: number; size: { height: number } }) => (
        <div data-testid="table-card" style={{ minHeight, height: size.height }}>{children}</div>
    ),
}));

const table = {
    id: 1, boardId: 1, x: 0, y: 0, z: 1, width: 360, height: 180,
    source: {
        columns: [{ id: "name", name: "Name", width: 160 }],
        rows: [
            { id: "first", cells: { name: "First" } },
            { id: "second", cells: { name: "Second" } },
        ],
    },
};

const props = {
    zoom: 1, isEditing: true,
    onEditing: vi.fn(), onEditingClear: vi.fn(), onInsert: vi.fn(), onUpdate: vi.fn(),
    onDelete: vi.fn(), onBringToFront: vi.fn(), onSendToBack: vi.fn(),
};

describe("테이블 카드 최소 높이", () => {
    it("툴바·머리글·행·테두리 높이를 모두 반영한다", () => {
        const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `row-${index}`, cells: {} }));

        expect(getTableCardMinHeight(rows(0))).toBe(128);
        expect(getTableCardMinHeight(rows(1))).toBe(131);
        expect(getTableCardMinHeight(rows(2))).toBe(168);
        expect(getTableCardMinHeight(rows(10))).toBe(464);
    });

    it("저장된 행 높이를 사용하되 최소 행 높이보다 줄이지 않는다", () => {
        expect(getTableCardMinHeight([
            { id: "tall", cells: {}, height: 100 },
            { id: "short", cells: {}, height: 10 },
        ])).toBe(49 + 40 + 5 + 100 + 37);
    });

    it("저장된 행 높이가 더 크면 카드를 확장한다", () => {
        const tallTable = {
            ...table,
            source: {
                ...table.source,
                rows: [{ ...table.source.rows[0], height: 120 }, table.source.rows[1]],
            },
        };

        render(<TableCard {...props} table={tallTable} />);
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "251px", height: "251px" });
    });

    it("행을 추가하면 리사이즈 최소 높이를 갱신하고 카드를 확장한다", () => {
        render(<TableCard {...props} table={table} />);
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "168px", height: "180px" });

        fireEvent.click(screen.getByRole("button", { name: /Row$/ }));
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "205px", height: "205px" });

        fireEvent.click(screen.getAllByLabelText("Select row")[0]);
        fireEvent.click(screen.getByRole("button", { name: "Delete selected rows" }));
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "168px" });
    });

    it("최소 크기보다 작은 저장 카드를 열면 모든 행에 맞춘다", () => {
        render(<TableCard {...props} table={{ ...table, height: 128 }} />);
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "168px", height: "168px" });
    });
});
