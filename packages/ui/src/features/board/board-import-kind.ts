export type BoardImportKind = "markdown" | "sqlite";

const sqliteMagicHeader = "SQLite format 3\0";
const markdownExtensionPattern = /\.(?:md|markdown|mdown|mkd)$/i;
const markdownMimeTypes = new Set(["text/markdown", "text/x-markdown"]);

type InspectableFile = {
    name?: string;
    type?: string;
    slice?: (start?: number, end?: number) => Blob;
    arrayBuffer: () => Promise<ArrayBuffer>;
};

async function hasSqliteMagicHeader(file: InspectableFile): Promise<boolean> {
    try {
        const buffer = typeof file.slice === "function"
            ? await file.slice(0, sqliteMagicHeader.length).arrayBuffer()
            : await file.arrayBuffer();
        if (buffer.byteLength < sqliteMagicHeader.length) {
            return false;
        }
        const bytes = new Uint8Array(buffer, 0, sqliteMagicHeader.length);
        for (let index = 0; index < sqliteMagicHeader.length; index += 1) {
            if (bytes[index] !== sqliteMagicHeader.charCodeAt(index)) {
                return false;
            }
        }
        return true;
    } catch {
        return false;
    }
}

export async function detectBoardImportKind(file: InspectableFile): Promise<BoardImportKind> {
    if (await hasSqliteMagicHeader(file)) {
        return "sqlite";
    }
    const name = file.name?.trim() ?? "";
    const mimeType = file.type?.trim().toLowerCase() ?? "";
    if (markdownExtensionPattern.test(name) || markdownMimeTypes.has(mimeType)) {
        return "markdown";
    }
    return "sqlite";
}
