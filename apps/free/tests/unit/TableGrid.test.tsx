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

describe("TableGrid 동작", () => {
    it("테이블 엔진으로 저장된 열과 셀을 렌더링한다", () => {
        const { container } = render(<TableHarness />);

        expect(container.firstElementChild).toHaveClass("h-full");
        expect(container.querySelector(".meldrift-table")).toBeInTheDocument();
        expect(getColumnNames()).toEqual(["Name", "Role"]);
        expect(screen.getByText("Kyu")).toBeInTheDocument();
        expect(screen.getByText("User")).toBeInTheDocument();
    });

    it("에디터를 열린 상태로 유지하면서 열 이름 변경을 전달한다", () => {
        render(<TableHarness />);
        const editor = editColumnName("Name");

        expect(editor).toHaveValue("Name");
        fireEvent.input(editor, { target: { value: "Member" } });

        expect(readSource().columns[0].name).toBe("Member");
        expect(screen.getByLabelText("Column name")).toBe(editor);
    });

    it("셀을 초기화해 열과 행을 추가한다", () => {
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

    it("최소 한 개의 데이터 행을 남기고 선택한 행을 삭제한다", () => {
        const { unmount } = render(<TableHarness />);

        fireEvent.click(screen.getAllByLabelText("Select row")[0]);
        fireEvent.click(screen.getByRole("button", { name: "Delete selected rows" }));

        expect(readSource().rows.map((row) => row.id)).toEqual(["row-2"]);

        unmount();
        render(<TableHarness initialValue={{ ...initialSource, rows: [initialSource.rows[0]] }} />);
        fireEvent.click(screen.getByLabelText("Select row"));

        expect(screen.getByRole("button", { name: "Delete selected rows" })).toBeDisabled();
    });

    it("열과 해당 셀을 삭제하되 마지막 열은 삭제하지 않는다", () => {
        render(<TableHarness />);

        fireEvent.click(screen.getByRole("button", { name: "Delete Name" }));

        const source = readSource();
        expect(source.columns.map((column) => column.id)).toEqual(["role"]);
        expect(source.rows[0].cells).toEqual({ role: "Admin" });
        expect(screen.queryByRole("button", { name: "Delete Role" })).not.toBeInTheDocument();
    });

    it("읽기 전용 모드에서는 편집 컨트롤 없이 값을 표시한다", () => {
        render(<TableHarness isEditing={false} />);

        expect(screen.getByText("Kyu")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Row$/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Column$/ })).toBeDisabled();
        screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());

        doubleClickColumn("Name");
        expect(screen.queryByLabelText("Column name")).not.toBeInTheDocument();
    });

    it("카드 모드 변경에 따라 읽기 전용과 편집 모드를 전환한다", () => {
        const { rerender } = render(<TableGrid source={initialSource} isEditing={false} onChange={() => {}} />);
        doubleClickColumn("Name");
        expect(screen.queryByLabelText("Column name")).not.toBeInTheDocument();

        rerender(<TableGrid source={initialSource} isEditing onChange={() => {}} />);
        expect(editColumnName("Name")).toHaveValue("Name");
        expect(screen.getByRole("button", { name: /Row$/ })).toBeEnabled();
    });

    it("외부에서 교체한 표 소스를 표시한다", () => {
        render(<TableHarness />);

        fireEvent.input(editColumnName("Name"), { target: { value: "Member" } });
        expect(getColumnNames()).toEqual(["Member", "Role"]);

        fireEvent.click(screen.getByRole("button", { name: "Restore" }));
        expect(getColumnNames()).toEqual(["Name", "Role"]);
    });
});
