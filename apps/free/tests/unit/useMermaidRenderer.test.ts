import { createElement } from "react";
import { render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mermaidMock = vi.hoisted(() => ({
    initialize: vi.fn(),
    registerExternalDiagrams: vi.fn().mockResolvedValue(undefined),
    parse: vi.fn(),
    render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaidMock }));
vi.mock("@mermaid-js/mermaid-zenuml", () => ({ default: { id: "zenuml" } }));

import { useMermaidRenderer } from "@/hooks/useMermaidRenderer";

describe("useMermaidRenderer", () => {
    beforeEach(() => {
        mermaidMock.parse.mockReset();
        mermaidMock.render.mockReset();
    });

    it("renders a responsive SVG and removes Mermaid artifacts", async () => {
        mermaidMock.render.mockImplementation(async (id: string) => {
            const artifact = document.createElement("div");
            artifact.id = id;
            document.body.appendChild(artifact);
            return { svg: '<svg width="400" height="300" viewBox="0 0 400 300"></svg>' };
        });

        const { result } = renderHook(() => useMermaidRenderer({ source: "flowchart LR\nA-->B", mermaidId: 5 }));

        await waitFor(() => expect(result.current.svg).toContain("<svg"));
        expect(result.current.svg).not.toContain('width="400"');
        expect(result.current.svg).not.toContain('height="300"');
        expect(result.current.svg).toContain('preserveAspectRatio="xMidYMid meet"');
        expect(mermaidMock.parse).not.toHaveBeenCalled();
        expect(document.querySelector("[id^='meldrift-mermaid-5-']")).toBeNull();
    });

    it("reports syntax errors and clears an empty source", async () => {
        mermaidMock.render.mockRejectedValue(new Error("Syntax error"));
        const { result, rerender } = renderHook(
            ({ source }) => useMermaidRenderer({ source, mermaidId: 2 }),
            { initialProps: { source: "invalid" } },
        );
        await waitFor(() => expect(result.current.renderError).toBe("Syntax error"));

        rerender({ source: "   " });
        await waitFor(() => expect(result.current.renderError).toBe(""));
        expect(result.current.svg).toBe("");
    });

    it("removes ZenUML styles that overwrite Tailwind variables", async () => {
        const style = document.createElement("style");
        style.textContent = ".zenuml .sequence-diagram { --tw-ring-shadow: none; }";
        document.head.appendChild(style);
        mermaidMock.render.mockResolvedValue({ svg: "<svg></svg>" });

        renderHook(() => useMermaidRenderer({ source: "zenuml", mermaidId: 9 }));
        await waitFor(() => expect(style.isConnected).toBe(false));
    });

    it("renders a changed source without queueing a separate parse", async () => {
        mermaidMock.render.mockImplementation(async (id: string, source: string) => ({
            svg: `<svg id="${id}"><text>${source}</text></svg>`,
        }));

        function MermaidPreview({ source }: { source: string }) {
            const { svg } = useMermaidRenderer({ source, mermaidId: 10 });
            return createElement("div", {
                className: "mermaid-rendered",
                dangerouslySetInnerHTML: { __html: svg },
            });
        }

        const preview = render(createElement(MermaidPreview, { source: "flowchart LR\nA-->B" }));
        await waitFor(() => expect(preview.container.querySelector("svg")?.textContent).toContain("A-->B"));
        preview.rerender(createElement(MermaidPreview, { source: "flowchart LR\nB-->C" }));
        await waitFor(() => expect(preview.container.querySelector("svg")?.textContent).toContain("B-->C"));

        expect(mermaidMock.render).toHaveBeenCalledTimes(2);
        expect(mermaidMock.parse).not.toHaveBeenCalled();
    });
});
