export const boardPreviewSessionKey = "meldrift-preview-board-id";

export const boardPreviewFolder = (boardId: number) => `meldrift/boards/${boardId}`;
export const boardPreviewPublicId = (boardId: number) => `${boardPreviewFolder(boardId)}/PreviewIMG`;

export function boardPreviewUrl(cloudName: string, boardId: number, version: number | null) {
    const versionSegment = version ? `v${version}/` : "";
    return `https://res.cloudinary.com/${cloudName}/image/upload/${versionSegment}${boardPreviewPublicId(boardId)}.webp`;
}
