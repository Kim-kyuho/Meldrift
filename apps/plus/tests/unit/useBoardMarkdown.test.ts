import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBoardMarkdown } from "@/hooks/useBoardMarkdown";

describe("useBoardMarkdown", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("loads markdown and separates Mermaid source blocks", async () => {
        const markdown = "# Title\n\n```mermaid\nflowchart LR\nA-->B\n```\n\nEnd";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ ok: true, markdown }),
        }));

        const { result } = renderHook(() => useBoardMarkdown(3));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(fetch).toHaveBeenCalledWith("/api/boards/3/markdown", expect.objectContaining({
            signal: expect.any(AbortSignal),
        }));
        expect(result.current.markdown).toBe(markdown);
        expect(result.current.markdownSections).toEqual([
            "# Title\n\n",
            "flowchart LR\nA-->B\n",
            "\n\nEnd",
        ]);
    });

    it("uses the server error and handles a rejected request", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: false,
                json: vi.fn().mockResolvedValue({ ok: false, message: "Denied" }),
            })
            .mockRejectedValueOnce(new Error("network"));
        vi.stubGlobal("fetch", fetchMock);

        const first = renderHook(() => useBoardMarkdown(1));
        await waitFor(() => expect(first.result.current.errorMessage).toBe("Denied"));
        first.unmount();

        const second = renderHook(() => useBoardMarkdown(2));
        await waitFor(() => expect(second.result.current.errorMessage)
            .toBe("Markdown document could not be generated."));
    });

    it("downloads the generated markdown and revokes the object URL", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ ok: true, markdown: "# Board" }),
        }));
        const createObjectURL = vi.fn().mockReturnValue("blob:test");
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

        const { result } = renderHook(() => useBoardMarkdown(8));
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => result.current.handleMarkdownDownload());

        expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(click).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    });
});
