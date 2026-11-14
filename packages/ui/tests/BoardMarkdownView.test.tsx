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

describe("BoardMarkdownView 동작", () => {
    beforeEach(() => { engine.renderers.length = 0; });

    it("마크다운과 Mermaid 구간을 렌더링한다", () => {
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

    it("읽기 전용 렌더러를 다시 생성하지 않고 소스를 갱신하며 이동한 노드에 맞춰 미리보기를 조정한다", async () => {
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

    it("미리보기를 닫으면 읽기 전용 렌더러를 제거한다", () => {
        const { unmount } = render(<MermaidDiagramView source="flowchart LR\nA-->B" />);
        const [renderer] = engine.renderers;
        unmount();
        expect(renderer.destroy).toHaveBeenCalledOnce();
        expect(renderer.element.isConnected).toBe(false);
    });

    it("미리보기 이미지 경로를 변환하고 화면 동작을 전달한다", () => {
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
