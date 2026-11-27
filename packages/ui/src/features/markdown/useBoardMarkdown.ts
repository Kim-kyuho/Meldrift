import { useEffect, useMemo, useRef, useState } from "react";
import { strToU8, zipSync } from "fflate";
import {
    compileBoardMarkdownDocument,
    type BoardMarkdownImageAsset,
} from "@meldrift/board-data/board-markdown";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import {
    imageBytesToBlob,
    imageBytesToPng,
} from "@meldrift/board-data/image-file";

type ImagePreview =
    | { url: string }
    | { errorMessage: string };

type ImagePreviewCache = Map<Uint8Array, Map<string, ImagePreview>>;

function createImagePreview({ data, mimeType }: BoardMarkdownImageAsset): ImagePreview {
    try {
        return { url: URL.createObjectURL(imageBytesToBlob(data, mimeType)) };
    } catch (error) {
        return {
            errorMessage: error instanceof Error
                ? error.message
                : "The image preview could not be created.",
        };
    }
}

function releaseUnusedImagePreviews(previous: ImagePreviewCache, next?: ImagePreviewCache): boolean {
    let removed = false;
    for (const [data, previews] of previous) {
        for (const [mimeType, preview] of previews) {
            if (next?.get(data)?.has(mimeType)) {
                continue;
            }
            if ("url" in preview) {
                URL.revokeObjectURL(preview.url);
            }
            removed = true;
        }
    }
    return removed;
}

function updateImagePreviews(assets: BoardMarkdownImageAsset[], previous: ImagePreviewCache): ImagePreviewCache {
    const next: ImagePreviewCache = new Map();
    let added = false;
    for (const asset of assets) {
        const { data, mimeType } = asset;
        const previews = next.get(data) ?? new Map<string, ImagePreview>();
        if (!previews.has(mimeType)) {
            const cached = previous.get(data)?.get(mimeType);
            previews.set(mimeType, cached ?? createImagePreview(asset));
            added ||= !cached;
        }
        next.set(data, previews);
    }
    const removed = releaseUnusedImagePreviews(previous, next);
    return added || removed ? next : previous;
}

export function useBoardMarkdown(snapshot: BoardSnapshot) {
    const compiledDocument = useMemo(() => compileBoardMarkdownDocument(snapshot), [snapshot]);
    const { markdown, imageAssets } = compiledDocument;
    const previewCacheRef = useRef<ImagePreviewCache>(new Map());
    const [previewCache, setPreviewCache] = useState<ImagePreviewCache>(() => new Map());
    const [downloadError, setDownloadError] = useState("");
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        // Keep Blob URLs across text edits and draft-to-saved image ID changes.
        const next = updateImagePreviews(imageAssets, previewCacheRef.current);
        previewCacheRef.current = next;
        let active = true;
        queueMicrotask(() => {
            if (active) {
                setPreviewCache(next);
            }
        });
        return () => {
            active = false;
        };
    }, [imageAssets]);

    useEffect(() => () => {
        releaseUnusedImagePreviews(previewCacheRef.current);
        previewCacheRef.current = new Map();
    }, []);

    const previewImageUrls: Record<string, string> = {};
    let previewError = "";
    let loading = false;
    for (const { path, data, mimeType } of imageAssets) {
        const preview = previewCache.get(data)?.get(mimeType);
        if (!preview) {
            loading = true;
        } else if ("url" in preview) {
            previewImageUrls["./" + path] = preview.url;
        } else {
            previewError ||= preview.errorMessage;
        }
    }

    const handleMarkdownDownload = async () => {
        setDownloadError("");
        setDownloading(true);

        try {
            const markdownFileName = `board-${snapshot.board.boardId}.md`;
            const files: Record<string, Uint8Array> = {
                [markdownFileName]: strToU8(markdown),
            };

            for (const asset of compiledDocument.imageAssets) {
                files[asset.path] = await imageBytesToPng(asset.data, asset.mimeType);
            }

            const archive = zipSync(files, { level: 6 });
            const fileUrl = URL.createObjectURL(imageBytesToBlob(archive, "application/zip"));
            const downloadLink = window.document.createElement("a");
            downloadLink.href = fileUrl;
            downloadLink.download = `meldrift-board-${snapshot.board.boardId}.zip`;
            window.document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            URL.revokeObjectURL(fileUrl);
        } catch (error) {
            setDownloadError(error instanceof Error ? error.message : "The Markdown archive could not be created.");
        } finally {
            setDownloading(false);
        }
    };

    return {
        markdown,
        sections: compiledDocument.sections,
        unlinkedCardCount: compiledDocument.unlinkedCardCount,
        previewImageUrls,
        errorMessage: previewError || downloadError,
        loading,
        downloading,
        handleMarkdownDownload,
    };
}
