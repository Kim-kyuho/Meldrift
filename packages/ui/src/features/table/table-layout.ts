import { TABLE_COLUMN_MIN_WIDTH } from "@meldrift/core/table-card";

export const TABLE_CARD_MIN_WIDTH = 360;
export const TABLE_SELECT_COLUMN_WIDTH = 32;
export const TABLE_ROW_MIN_HEIGHT = 37;

const TABLE_TOOLBAR_HEIGHT = 49;
const TABLE_HEADER_HEIGHT = 40;
const TABLE_BORDER_WIDTH = 2;
const TABLE_BORDER_HEIGHT = 5;
const TABLE_CARD_MIN_HEIGHT = 128;

export const getTableCardMinWidth = (columnCount: number) => Math.max(
    TABLE_CARD_MIN_WIDTH,
    TABLE_SELECT_COLUMN_WIDTH + TABLE_BORDER_WIDTH + columnCount * TABLE_COLUMN_MIN_WIDTH,
);

export const getTableCardMinHeight = (rowCount: number) => Math.max(
    TABLE_CARD_MIN_HEIGHT,
    TABLE_TOOLBAR_HEIGHT + TABLE_HEADER_HEIGHT + TABLE_BORDER_HEIGHT + rowCount * TABLE_ROW_MIN_HEIGHT,
);
