import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import TableGrid from "@/components/TableGrid";
import type { TableSource } from "@/lib/table-card";

const initialSource: TableSource = {
    columns: [
        { id: "name", name: "Name", width: 160 },
        { id: "role", name: "Role", width: 160 },
    ],
    rows: [
        { id: "row-1", cells: { name: "Kyu", role: "Admin" } },
        { id: "row-2", cells: { name: "Lee", role: "User" } },
    ],
};

function TableHarness({
    isEditing = true,
    initialValue = initialSource,
}: {
    isEditing?: boolean;
    initialValue?: TableSource;
}) {
    const [source, setSource] = useState(initialValue);
    return (
        <>
            <TableGrid source={source} isEditing={isEditing} onChange={setSource} />
            <output data-testid="source">{JSON.stringify(source)}</output>
        </>
    );
}

describe("TableGrid", () => {
    it("keeps the card surface transparent and only colors the editing toolbar", () => {
        const { container } = render(<TableHarness />);
        const grid = container.firstElementChild;
        const toolbar = grid?.firstElementChild;

        expect(grid).not.toHaveClass("bg-white");
        expect(toolbar).toHaveClass("bg-white");
    });

    it("keeps cell and column inputs mounted while editing values", () => {
        render(<TableHarness />);
        const columnInput = screen.getAllByLabelText("Column name")[0];
        const cellInput = screen.getByDisplayValue("Kyu");

        fireEvent.change(columnInput, { target: { value: "Member" } });
        fireEvent.change(cellInput, { target: { value: "Kyuho" } });

        expect(columnInput).toHaveValue("Member");
        expect(cellInput).toHaveValue("Kyuho");
        expect(cellInput.tagName).toBe("TEXTAREA");
        expect(cellInput).toHaveStyle({ overflowWrap: "anywhere" });
        expect(screen.getByTestId("source")).toHaveTextContent('"name":"Member"');
        expect(screen.getByTestId("source")).toHaveTextContent('"name":"Kyuho"');
    });

    it("adds a column and a row with initialized cells", () => {
        render(<TableHarness />);

        fireEvent.click(screen.getByRole("button", { name: /Column$/ }));
        fireEvent.click(screen.getByRole("button", { name: /Row$/ }));

        const source = JSON.parse(screen.getByTestId("source").textContent ?? "") as TableSource;
        const addedColumn = source.columns.at(-1);
        const addedRow = source.rows.at(-1);

        expect(addedColumn).toMatchObject({ name: "Column 3", width: 160 });
        expect(addedColumn?.id).toEqual(expect.any(String));
        expect(addedRow?.id).toEqual(expect.any(String));
        expect(addedRow?.cells).toEqual({ name: "", role: "", [addedColumn!.id]: "" });
    });

    it("deletes selected rows while preserving at least one data row", () => {
        const { unmount } = render(<TableHarness />);

        fireEvent.click(screen.getAllByLabelText("Select row")[0]);
        fireEvent.click(screen.getByRole("button", { name: "Delete selected rows" }));

        expect(JSON.parse(screen.getByTestId("source").textContent ?? "").rows).toHaveLength(1);

        unmount();
        render(<TableHarness initialValue={{ ...initialSource, rows: [initialSource.rows[0]] }} />);
        fireEvent.click(screen.getByLabelText("Select row"));

        expect(screen.getByRole("button", { name: "Delete selected rows" })).toBeDisabled();
    });

    it("deletes a column and its cells but never deletes the final column", () => {
        render(<TableHarness />);

        fireEvent.click(screen.getByRole("button", { name: "Delete Name" }));
        let source = JSON.parse(screen.getByTestId("source").textContent ?? "") as TableSource;
        expect(source.columns.map((column) => column.id)).toEqual(["role"]);
        expect(source.rows[0].cells).toEqual({ role: "Admin" });
        expect(screen.queryByRole("button", { name: "Delete Role" })).not.toBeInTheDocument();

        source = JSON.parse(screen.getByTestId("source").textContent ?? "") as TableSource;
        expect(source.columns).toHaveLength(1);
    });

    it("renders values without editing controls in read-only mode", () => {
        render(<TableHarness isEditing={false} />);

        expect(screen.getByText("Kyu")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Row$/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Column$/ })).toBeDisabled();
        screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());
        expect(screen.queryByPlaceholderText("Filter table")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Column name")).not.toBeInTheDocument();
    });

    it("does not render sorting, filtering, or pagination controls", () => {
        const rows = Array.from({ length: 10 }, (_, index) => ({
            id: `row-${index}`,
            cells: { name: `Name ${index}`, role: "User" },
        }));

        render(<TableHarness initialValue={{ ...initialSource, rows }} />);

        expect(screen.queryByRole("button", { name: "Sort Name" })).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText("Filter table")).not.toBeInTheDocument();
        expect(screen.queryByText("Previous")).not.toBeInTheDocument();
        expect(screen.queryByText("Next")).not.toBeInTheDocument();
        expect(screen.getByDisplayValue("Name 9")).toBeInTheDocument();
    });
});
