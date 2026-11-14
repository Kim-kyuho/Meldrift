import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BoardMarkdownView from "../src/features/markdown/BoardMarkdownPreview";
import MermaidDiagramView from "../src/features/mermaid/MermaidDiagramView";

const engine = vi.hoisted(() => {
    type RendererOptions = {
        source?: string;
        palette?: boolean;
        draggable?: boolean;
        editable?: boolean;
    };
    const createDiagramRenderer = (container: HTMLElement, options: RendererOptions) => {
        let source = options.source ?? "";
        const element = document.createElement("div");
        element.innerHTML = '<div class="meldrift-diagram-canvas"><div class="meldrift-diagram-svg"><svg><text></text></svg></div></div>';
        const svg = element.querySelector("svg")!;
        const text = element.querySelector("text")!;
        text.textContent = source;
        Object.defineProperty(svg, "getBBox", { value: () => ({ x: -200, y: 50, width: 500, height: 120 }) });
        container.append(element);

        const renderer = {
            options,
            element,
            setSource: vi.fn(async (next: string) => {
                source = next;
                text.textContent = next;
            }),
            getSource: () => source,
            destroy: vi.fn(() => element.remove()),
        };
        renderers.push(renderer);
        return renderer;
    };
    const renderers: Array<ReturnType<typeof createDiagramRenderer>> = [];
    return { createDiagramRenderer, renderers };
});

vi.mock("@meldrift/diagram-engine", () => ({ createDiagramRenderer: engine.createDiagramRenderer }));

describe("BoardMarkdownView", () => {
    beforeEach(() => { engine.renderers.length = 0; });

    it("renders Markdown and Mermaid sections", () => {
        render(
            <BoardMarkdownView
                markdown={"# Title\n\n```mermaid\nflowchart LR\nA-->B\n```"}
                errorMessage=""
                loading={false}
                onDownload={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
        expect(screen.getByText(/flowchart LR/)).toBeInTheDocument();
        expect(engine.renderers[0].options).toEqual({
            source: "flowchart LR\nA-->B", palette: false, draggable: false, editable: false,
        });
    });

    it("updates the preview source and fits moved nodes without recreating the read-only renderer", async () => {
        const { container, rerender } = render(<MermaidDiagramView source="flowchart LR\nA-->B" />);
        const [renderer] = engine.renderers;
        const nextSource = 'flowchart LR\nA["<literal>"]-->B\n%% meldrift-layout: {"B":[-200,50]}';

        rerender(<MermaidDiagramView source={nextSource} />);

        await waitFor(() => expect(container.querySelector("svg")).toHaveAttribute("viewBox", "-208 42 516 136"));
        expect(renderer.setSource).toHaveBeenCalledWith(nextSource);
        expect(container.querySelector("text")?.textContent).toBe(nextSource);
        expect(container.querySelector("literal")).toBeNull();
        expect(engine.renderers).toHaveLength(1);
        rerender(<MermaidDiagramView source={nextSource} />);
        expect(renderer.setSource).toHaveBeenCalledOnce();
    });

    it("destroys the read-only renderer when the preview is closed", () => {
        const { unmount } = render(<MermaidDiagramView source="flowchart LR\nA-->B" />);
        const [renderer] = engine.renderers;
        unmount();
        expect(renderer.destroy).toHaveBeenCalledOnce();
        expect(renderer.element.isConnected).toBe(false);
    });

    it("maps preview images and dispatches view actions", () => {
        const onDownload = vi.fn();
        const onClose = vi.fn();
        render(
            <BoardMarkdownView
                markdown="![Preview](./images/image-1.png)"
                previewImageUrls={{ "./images/image-1.png": "blob:preview" }}
                errorMessage=""
                loading={false}
                onDownload={onDownload}
                onClose={onClose}
            />
        );

        expect(screen.getByAltText("Preview")).toHaveAttribute("src", "blob:preview");
        fireEvent.click(screen.getByRole("button", { name: "Download Markdown" }));
        expect(onDownload).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole("button", { name: "Close Markdown view" }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
