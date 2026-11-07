import type { TableSource } from "@meldrift/core/table-card";
import { TABLE_COLUMN_MIN_WIDTH, TABLE_ROW_MIN_HEIGHT, TABLE_SELECT_COLUMN_WIDTH } from "@meldrift/table-engine";

export const TABLE_CARD_MIN_WIDTH = 360;

const TABLE_TOOLBAR_HEIGHT = 49;
const TABLE_HEADER_HEIGHT = 40;
const TABLE_BORDER_WIDTH = 2;
const TABLE_BORDER_HEIGHT = 5;
const TABLE_CARD_MIN_HEIGHT = 128;

const getRowHeight = (row: TableSource["rows"][number]) =>
    Math.max(row.height ?? TABLE_ROW_MIN_HEIGHT, TABLE_ROW_MIN_HEIGHT);

export const getTableCardMinWidth = (columnCount: number) => Math.max(
    TABLE_CARD_MIN_WIDTH,
    TABLE_SELECT_COLUMN_WIDTH + TABLE_BORDER_WIDTH + columnCount * TABLE_COLUMN_MIN_WIDTH,
);

// 엔진에서 늘린 행 높이까지 모두 보이도록 각 행의 저장된 높이를 더한다.
export const getTableCardMinHeight = (rows: TableSource["rows"]) => Math.max(
    TABLE_CARD_MIN_HEIGHT,
    TABLE_TOOLBAR_HEIGHT + TABLE_HEADER_HEIGHT + TABLE_BORDER_HEIGHT
        + rows.reduce((total, row) => total + getRowHeight(row), 0),
);
