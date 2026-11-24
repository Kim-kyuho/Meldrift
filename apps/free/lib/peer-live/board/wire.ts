import { defaultBoardId, parseBoardSnapshot, type BoardImage, type BoardSnapshot } from "@meldrift/board-data/board-state";
import { parseChangeRequest, type ChangeRequest } from "@meldrift/board-data/change-request";
import { maxStoredImageBytes, supportedImageMimeTypes } from "@meldrift/board-data/image-file";
import type { RemoteAsset } from "@meldrift/board-data/remote-patch";
import { z } from "zod";
import { maxBoardBytes, maxMetadataBytes, type Packet } from "../transport/packets";
import { sanitizeSharedChange, sanitizeSharedMemo } from "./memo-content";

const assetId = z.string().min(1).max(200);
const revision = z.number().int().nonnegative().safe();
const assetsSchema = z.array(z.object({
    id: assetId, mimeType: z.enum(supportedImageMimeTypes), digest: z.string().regex(/^[0-9a-f]{64}$/),
})).max(1023);

const boardEnvelope = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("snapshot"), revision, assets: assetsSchema, board: z.unknown() }),
    z.object({ kind: z.literal("propose"), sequence: revision, assets: assetsSchema, change: z.unknown() }),
    z.object({ kind: z.literal("commit"), revision, author: z.string().uuid(), assets: assetsSchema, change: z.unknown() }),
    z.object({ kind: z.literal("ready"), revision }),
]);

export type BoardProposal = { kind: "propose"; sequence: number; change: ChangeRequest; assets: ReadonlyMap<string, RemoteAsset> };
export type BoardCommit = {
    kind: "commit";
    revision: number;
    author: string;
    change: ChangeRequest;
    assets: ReadonlyMap<string, RemoteAsset>;
};
type BoardPacket = BoardProposal | BoardCommit
    | { kind: "snapshot"; revision: number; board: BoardSnapshot }
    | { kind: "ready"; revision: number };

const encoder = new TextEncoder();

async function sha256(bytes: Uint8Array) {
    const buffer = bytes.buffer instanceof ArrayBuffer
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : new Uint8Array(bytes);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hasImageSignature(bytes: Uint8Array, mimeType: string) {
    if (mimeType === "image/jpeg") {
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === "image/png") {
        return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    }
    return mimeType === "image/webp" && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
        && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
}

export function imageAssets(images: BoardImage[]) {
    const assets = new Map<string, RemoteAsset>();
    for (const image of images) {
        if (!image.data || !image.mimeType || image.url || !assetId.safeParse(image.assetId).success) {
            throw new Error("Replace external images with local image files before sharing this board.");
        }
        assets.set(image.assetId, { data: image.data, mimeType: image.mimeType });
    }
    return assets;
}

function boardMetadata(board: BoardSnapshot) {
    return { ...board, images: board.images.map((image) => ({ ...image, data: undefined })) };
}

export function validateShareableBoard(snapshot: BoardSnapshot) {
    const board = parseBoardSnapshot(snapshot);
    if (board.board.boardId !== defaultBoardId) {
        throw new Error("This is not a Free board.");
    }
    const assets = imageAssets(board.images);
    const metadataBytes = encoder.encode(JSON.stringify(boardMetadata(board))).byteLength;
    const bytes = [...assets.values()].reduce((size, asset) => size + asset.data.byteLength, metadataBytes);
    if (metadataBytes > maxMetadataBytes - 64 * 1024 || bytes > maxBoardBytes - 64 * 1024 || assets.size > 1023) {
        throw new Error("This board is too large to share. Remove some content and try again.");
    }
    return board;
}

export function changeAssets(board: BoardSnapshot, change: ChangeRequest) {
    const ids = new Set<string>();
    for (const operation of change.operations) {
        if (operation.type !== "image" || operation.action === "delete") {
            continue;
        }
        if (typeof operation.changes.assetId === "string") {
            ids.add(operation.changes.assetId);
        } else if (operation.asset) {
            const image = board.images.find(({ syncId }) => syncId === operation.syncId);
            if (image) {
                ids.add(image.assetId);
            }
        }
    }
    return imageAssets(board.images.filter(({ assetId }) => ids.has(assetId)));
}

export async function encodeBoardPacket(packet: BoardPacket): Promise<Packet> {
    if (packet.kind === "ready") {
        return { metadata: packet, assets: [] };
    }

    const assets = packet.kind === "snapshot" ? imageAssets(packet.board.images) : packet.assets;
    const manifest = await Promise.all([...assets].map(async ([id, asset]) => ({
        id, mimeType: asset.mimeType, digest: await sha256(asset.data),
    })));
    const metadata = packet.kind === "snapshot"
        ? { kind: "snapshot", revision: packet.revision, board: boardMetadata(packet.board), assets: manifest }
        : { ...packet, assets: manifest };
    return { metadata, assets: [...assets.values()].map(({ data }) => data) };
}

const snapshotImages = z.object({ images: z.array(z.object({ assetId }).passthrough()) }).passthrough();

export async function decodeBoardPacket(packet: Packet): Promise<BoardPacket> {
    const metadata = boardEnvelope.parse(packet.metadata);
    if (metadata.kind === "ready") {
        if (packet.assets.length > 0) {
            throw new Error("Unexpected image data.");
        }
        return metadata;
    }
    if (packet.assets.length !== metadata.assets.length) {
        throw new Error("Image data is incomplete.");
    }

    const assets = new Map<string, RemoteAsset>();
    for (const [index, { id, mimeType, digest }] of metadata.assets.entries()) {
        const data = packet.assets[index];
        if (assets.has(id) || data.byteLength > maxStoredImageBytes || !hasImageSignature(data, mimeType)
            || await sha256(data) !== digest) {
            throw new Error("The peer sent an invalid image.");
        }
        assets.set(id, { data, mimeType });
    }
    if (metadata.kind === "snapshot") {
        const board = snapshotImages.parse(metadata.board);
        const images = board.images.map((image) => {
            const asset = assets.get(image.assetId);
            if (!asset) {
                throw new Error("An image is missing from the shared board.");
            }
            return { ...image, ...asset, url: "" };
        });
        const snapshot = validateShareableBoard({ ...board, images } as BoardSnapshot);
        const memos = snapshot.memos.map((memo) => ({ ...memo, content: sanitizeSharedMemo(memo.content) }));
        return { kind: "snapshot", revision: metadata.revision, board: { ...snapshot, memos } };
    }
    return { ...metadata, assets, change: sanitizeSharedChange(parseChangeRequest(metadata.change)) };
}
