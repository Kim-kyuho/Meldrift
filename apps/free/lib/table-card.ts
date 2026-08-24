import { z } from "zod";

const tableColumnSchema = z.object({
    id: z.string().min(1),
    name: z.string(),
    width: z.number().positive().optional(),
});

const tableRowSchema = z.object({
    id: z.string().min(1),
    cells: z.record(z.string(), z.string()),
});

export const tableSourceSchema = z.object({
    columns: z.array(tableColumnSchema).min(1),
    rows: z.array(tableRowSchema).min(1),
});

export type TableSource = z.infer<typeof tableSourceSchema>;

export const createTableItemId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const escapeTableCell = (value: string) =>
    value
        .replaceAll("|", "\\|")
        .replace(/\r?\n/g, "<br>");

export const tableSourceToMarkdown = (source: TableSource) => {
    const header = `| ${source.columns.map((column) => escapeTableCell(column.name)).join(" | ")} |`;
    const separator = `| ${source.columns.map(() => "---").join(" | ")} |`;
    const rows = source.rows.map((row) =>
        `| ${source.columns.map((column) => escapeTableCell(row.cells[column.id] ?? "")).join(" | ")} |`
    );

    return [header, separator, ...rows].join("\n");
};

export const defaultTableSource: TableSource = {
    columns: [
        { id: "column-1", name: "Column 1", width: 160 },
        { id: "column-2", name: "Column 2", width: 160 },
    ],
    rows: [
        {
            id: "row-1",
            cells: {
                "column-1": "",
                "column-2": "",
            },
        },
        {
            id: "row-2",
            cells: {
                "column-1": "",
                "column-2": "",
            },
        },
    ],
};
