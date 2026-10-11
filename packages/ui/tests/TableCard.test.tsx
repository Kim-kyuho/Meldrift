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

describe("TableCard minimum height", () => {
    it("accounts for toolbar, header, rows and borders", () => {
        expect(getTableCardMinHeight(0)).toBe(128);
        expect(getTableCardMinHeight(1)).toBe(131);
        expect(getTableCardMinHeight(2)).toBe(168);
        expect(getTableCardMinHeight(10)).toBe(464);
    });

    it("updates the resize minimum and grows the card when a row is added", () => {
        render(<TableCard {...props} table={table} />);
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "168px", height: "180px" });

        fireEvent.click(screen.getByRole("button", { name: /Row$/ }));
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "205px", height: "205px" });

        fireEvent.click(screen.getAllByLabelText("Select row")[0]);
        fireEvent.click(screen.getByRole("button", { name: "Delete selected rows" }));
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "168px" });
    });

    it("fits all rows when opening an undersized saved card", () => {
        render(<TableCard {...props} table={{ ...table, height: 128 }} />);
        expect(screen.getByTestId("table-card")).toHaveStyle({ minHeight: "168px", height: "168px" });
    });
});
