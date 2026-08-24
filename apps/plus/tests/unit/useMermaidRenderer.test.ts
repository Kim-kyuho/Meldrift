import { render, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mermaidMock = vi.hoisted(() => ({
    initialize: vi.fn(),
    registerExternalDiagrams: vi.fn().mockResolvedValue(undefined),
    render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaidMock }));
vi.mock("@mermaid-js/mermaid-zenuml", () => ({ default: { id: "zenuml" } }));

import { useMermaidRenderer } from "@/hooks/useMermaidRenderer";

describe("useMermaidRenderer", () => {
    beforeEach(() => {
        mermaidMock.render.mockReset();
        document.body.innerHTML = "";
        document.head.querySelectorAll("style").forEach((style) => style.remove());
    });

    it("renders a responsive SVG and removes Mermaid artifacts", async () => {
        mermaidMock.render.mockImplementation(async (id: string) => {
            const artifact = document.createElement("div");
            artifact.id = `d${id}`;
            document.body.appendChild(artifact);
            return { svg: `<svg id="${id}" width="400" height="300" viewBox="0 0 400 300"></svg>` };
        });

        const { result } = renderHook(() => useMermaidRenderer({ source: "flowchart LR\nA-->B", mermaidId: 5 }));

        await waitFor(() => expect(result.current.svg).toContain("<svg"));
        expect(result.current.svg).not.toContain('width="400"');
        expect(result.current.svg).not.toContain('height="300"');
        expect(result.current.svg).toContain('preserveAspectRatio="xMidYMid meet"');
        expect(document.querySelector("[id^='dkyuboard-mermaid-5-']")).toBeNull();
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

    it("keeps the rendered SVG while removing Mermaid temporary elements", async () => {
        mermaidMock.render.mockImplementation(async (id: string) => {
            const preview = document.createElement("div");
            preview.className = "mermaid-rendered";
            const renderedSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            renderedSvg.id = id;
            preview.appendChild(renderedSvg);
            document.body.appendChild(preview);

            const temporaryContainer = document.createElement("div");
            temporaryContainer.id = `d${id}`;
            document.body.appendChild(temporaryContainer);

            return { svg: `<svg id="${id}"></svg>` };
        });

        const { result } = renderHook(() => useMermaidRenderer({ source: "flowchart LR\nA-->B", mermaidId: 11 }));

        await waitFor(() => expect(result.current.svg).toContain("<svg"));
        expect(document.querySelector(".mermaid-rendered svg")?.isConnected).toBe(true);
        expect(document.querySelector("[id^='dkyuboard-mermaid-11-']")).toBeNull();
    });

    it("updates the displayed SVG when only the source changes", async () => {
        mermaidMock.render.mockImplementation(async (id: string, source: string) => ({
            svg: `<svg id="${id}" data-source="${source}"></svg>`,
        }));

        const MermaidPreview = ({ source }: { source: string }) => {
            const { svg } = useMermaidRenderer({ source, mermaidId: 12 });

            return createElement("div", {
                className: "mermaid-rendered",
                dangerouslySetInnerHTML: { __html: svg },
            });
        };
        const { container, rerender } = render(createElement(MermaidPreview, { source: "flowchart LR; A-->B" }));

        await waitFor(() => expect(container.querySelector("svg")?.getAttribute("data-source"))
            .toBe("flowchart LR; A-->B"));

        rerender(createElement(MermaidPreview, { source: "flowchart LR; B-->C" }));

        await waitFor(() => expect(container.querySelector("svg")?.getAttribute("data-source"))
            .toBe("flowchart LR; B-->C"));
    });
});
