import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import TableGrid from "@meldrift/ui/TableGrid";
import type { TableSource } from "@meldrift/core/table-card";

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
            <button type="button" onClick={() => setSource(initialSource)}>Restore</button>
        </>
    );
}

const readSource = () => JSON.parse(screen.getByTestId("source").textContent ?? "") as TableSource;

const COLUMN_NAME = ".meldrift-table-column-name";

const getColumnNames = () => Array.from(document.querySelectorAll(COLUMN_NAME), (name) => name.textContent);

const doubleClickColumn = (name: string) => {
    fireEvent.doubleClick(screen.getByText(name, { selector: COLUMN_NAME }));
};

const editColumnName = (name: string) => {
    doubleClickColumn(name);
    return screen.getByLabelText<HTMLTextAreaElement>("Column name");
};

describe("TableGrid", () => {
    it("renders the saved columns and cells with the table engine", () => {
        const { container } = render(<TableHarness />);

        expect(container.firstElementChild).toHaveClass("h-full");
        expect(container.querySelector(".meldrift-table")).toBeInTheDocument();
        expect(getColumnNames()).toEqual(["Name", "Role"]);
        expect(screen.getByText("Kyu")).toBeInTheDocument();
        expect(screen.getByText("User")).toBeInTheDocument();
    });

    it("reports column name changes while the editor stays open", () => {
        render(<TableHarness />);
        const editor = editColumnName("Name");

        expect(editor).toHaveValue("Name");
        fireEvent.input(editor, { target: { value: "Member" } });

        expect(readSource().columns[0].name).toBe("Member");
        expect(screen.getByLabelText("Column name")).toBe(editor);
    });

    it("adds a column and a row with initialized cells", () => {
        render(<TableHarness />);

        fireEvent.click(screen.getByRole("button", { name: /Column$/ }));
        fireEvent.click(screen.getByRole("button", { name: /Row$/ }));

        const source = readSource();
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

        expect(readSource().rows.map((row) => row.id)).toEqual(["row-2"]);

        unmount();
        render(<TableHarness initialValue={{ ...initialSource, rows: [initialSource.rows[0]] }} />);
        fireEvent.click(screen.getByLabelText("Select row"));

        expect(screen.getByRole("button", { name: "Delete selected rows" })).toBeDisabled();
    });

    it("deletes a column and its cells but never deletes the final column", () => {
        render(<TableHarness />);

        fireEvent.click(screen.getByRole("button", { name: "Delete Name" }));

        const source = readSource();
        expect(source.columns.map((column) => column.id)).toEqual(["role"]);
        expect(source.rows[0].cells).toEqual({ role: "Admin" });
        expect(screen.queryByRole("button", { name: "Delete Role" })).not.toBeInTheDocument();
    });

    it("renders values without editing controls in read-only mode", () => {
        render(<TableHarness isEditing={false} />);

        expect(screen.getByText("Kyu")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Row$/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Column$/ })).toBeDisabled();
        screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());

        doubleClickColumn("Name");
        expect(screen.queryByLabelText("Column name")).not.toBeInTheDocument();
    });

    it("switches between read-only and editing when the card mode changes", () => {
        const { rerender } = render(<TableGrid source={initialSource} isEditing={false} onChange={() => {}} />);
        doubleClickColumn("Name");
        expect(screen.queryByLabelText("Column name")).not.toBeInTheDocument();

        rerender(<TableGrid source={initialSource} isEditing onChange={() => {}} />);
        expect(editColumnName("Name")).toHaveValue("Name");
        expect(screen.getByRole("button", { name: /Row$/ })).toBeEnabled();
    });

    it("shows a source replaced from outside the table", () => {
        render(<TableHarness />);

        fireEvent.input(editColumnName("Name"), { target: { value: "Member" } });
        expect(getColumnNames()).toEqual(["Member", "Role"]);

        fireEvent.click(screen.getByRole("button", { name: "Restore" }));
        expect(getColumnNames()).toEqual(["Name", "Role"]);
    });
});
