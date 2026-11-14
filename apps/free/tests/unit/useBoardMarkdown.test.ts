import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { strFromU8, unzipSync } from "fflate";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoardMarkdownView from "@meldrift/ui/BoardMarkdownView";
import { useBoardMarkdown } from "@meldrift/ui/useBoardMarkdown";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@/lib/board-state";

function installObjectUrlMock() {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob);
        return `blob:test-${blobs.length}`;
    });
    const revokeObjectURL = vi.fn();
    const NativeURL = URL;

    class MockURL extends NativeURL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
    }

    vi.stubGlobal("URL", MockURL);
    return { blobs, createObjectURL, revokeObjectURL };
}

function markdownSnapshot(): BoardSnapshot {
    return {
        ...createEmptyBoardSnapshot(),
        memos: [{
            id: 1, syncId: "memo-1", boardId: 1, content: "<h1>Title</h1><p>End</p>",
            x: 10, y: 10, z: 1, width: 100, height: 100, color: "#fffadc", sortOrder: 1,
        }],
        mermaids: [{
            id: 1, syncId: "mermaid-1", boardId: 1, source: "flowchart LR\nA-->B",
            x: 0, y: 0, z: 2, width: 50, height: 50,
        }],
    };
}

describe("useBoardMarkdown 동작", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("로컬 보드 상태를 Mermaid 소스 블록과 함께 컴파일한다", () => {
        const { result } = renderHook(() => useBoardMarkdown(markdownSnapshot()));
        expect(result.current.loading).toBe(false);
        expect(result.current.errorMessage).toBe("");
        expect(result.current.markdown).toContain("# Title");
        expect(result.current.markdown).toContain("```mermaid");
        expect(result.current.markdown).toContain("flowchart LR\nA-->B");
    });

    it("서버 요청 없이 겹친 URL 이미지를 컴파일한다", () => {
        const snapshot = markdownSnapshot();
        snapshot.mermaids = [];
        snapshot.images = [{
            imageId: 1, syncId: "image-1", assetId: "", boardId: 1, url: "https://example.com/a.png", label: "A",
            data: null, mimeType: null,
            x: 0, y: 0, z: 2, width: 50, height: 50,
        }];
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useBoardMarkdown(snapshot));
        expect(result.current.markdown).toContain("![A](https://example.com/a.png)");
        expect(fetchMock).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it("로컬 이미지 미리보기에 임시 Blob URL을 사용하고 해제한다", async () => {
        const { createObjectURL, revokeObjectURL } = installObjectUrlMock();
        const snapshot = markdownSnapshot();
        snapshot.mermaids = [];
        snapshot.images = [{
            imageId: 1, syncId: "image-1", assetId: "asset-1", boardId: 1, url: "", data: new Uint8Array([1, 2, 3]),
            mimeType: "image/png", label: "Local",
            x: 0, y: 0, z: 2, width: 50, height: 50,
        }];

        const { result, unmount } = renderHook(() => useBoardMarkdown(snapshot));
        expect(result.current.markdown).toContain("![Local](./images/image-1.png)");
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.previewImageUrls["./images/image-1.png"]).toBe("blob:test-1");
        expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "image/png" }));

        unmount();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-1");
    });

    it("임시 Blob URL로 컴파일된 로컬 이미지를 렌더링한다", async () => {
        installObjectUrlMock();
        const snapshot = markdownSnapshot();
        snapshot.mermaids = [];
        snapshot.images = [{
            imageId: 2, syncId: "image-2", assetId: "asset-1", boardId: 1, url: "", data: new Uint8Array([1, 2, 3]),
            mimeType: "image/webp", label: "Local preview",
            x: 0, y: 0, z: 2, width: 50, height: 50,
        }];

        render(createElement(BoardMarkdownView, { snapshot, onClose: vi.fn() }));

        await waitFor(() => expect(screen.getByAltText("Local preview"))
            .toHaveAttribute("src", "blob:test-1"));
    });

    it("마크다운과 로컬 PNG 이미지를 하나의 ZIP 파일로 다운로드한다", async () => {
        const { blobs, revokeObjectURL } = installObjectUrlMock();
        let downloadName = "";
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            downloadName = this.download;
        });
        const snapshot = markdownSnapshot();
        snapshot.mermaids = [];
        snapshot.images = [{
            imageId: 4, syncId: "image-4", assetId: "asset-1", boardId: 1, url: "", data: new Uint8Array([137, 80, 78, 71]),
            mimeType: "image/png", label: "Saved image",
            x: 0, y: 0, z: 2, width: 50, height: 50,
        }];

        const { result } = renderHook(() => useBoardMarkdown(snapshot));
        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => {
            await result.current.handleMarkdownDownload();
        });

        const archiveBlob = blobs.at(-1)!;
        expect(archiveBlob.type).toBe("application/zip");
        const archive = unzipSync(new Uint8Array(await archiveBlob.arrayBuffer()));
        expect(strFromU8(archive["board-1.md"]))
            .toContain("![Saved image](./images/image-4.png)");
        expect(archive["images/image-4.png"]).toEqual(new Uint8Array([137, 80, 78, 71]));
        expect(downloadName).toBe("meldrift-board-1.zip");
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-2");
    });
});
