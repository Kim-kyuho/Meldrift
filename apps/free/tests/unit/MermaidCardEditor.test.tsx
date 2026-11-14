import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const engine = vi.hoisted(() => {
    type RendererOptions = {
        source?: string;
        onShapeSelect?: (item: { label: string; snippet: string }) => void;
        onLayoutChange?: (source: string) => void;
        onSourceChange?: (source: string) => void;
        onExpand?: (grow: { left: number; top: number; right: number; bottom: number }) => void;
    };
    type EditorOptions = {
        value?: string;
        onChange?: (value: string) => void;
        onCursorChange?: (offset: number) => void;
    };

    const state = {
        renderers: [] as Array<{
            container: HTMLElement;
            options: RendererOptions;
            setSource: Mock<(next: string) => Promise<void>>;
            setCursor: Mock<(offset: number) => void>;
            destroy: Mock<() => void>;
            palette: HTMLElement;
            canvas: HTMLElement;
        }>,
        editors: [] as Array<{
            container: HTMLElement;
            options: EditorOptions;
            setValue: Mock<(value: string) => void>;
            insertPaletteItem: Mock<(item: { label: string; snippet: string }) => void>;
            destroy: Mock<() => void>;
        }>,
    };

    const createDiagramRenderer = (container: HTMLElement, options: RendererOptions) => {
        let source = options.source ?? "";
        const root = document.createElement("div");
        root.className = "meldrift-diagram-renderer";
        const canvas = document.createElement("div");
        canvas.className = "meldrift-diagram-canvas";
        const palette = document.createElement("div");
        palette.className = "meldrift-diagram-palette";
        root.append(canvas, palette);
        container.append(root);

        const renderer = {
            container,
            options,
            palette,
            canvas,
            element: root,
            setSource: vi.fn(async (next: string) => {
                source = next;
            }),
            getSource: () => source,
            setCursor: vi.fn<(offset: number) => void>(),
            destroy: vi.fn(() => root.remove()),
        };
        state.renderers.push(renderer);
        return renderer;
    };

    const createDiagramEditor = (container: HTMLElement, options: EditorOptions) => {
        const root = document.createElement("div");
        root.className = "meldrift-diagram-editor";
        container.append(root);

        const editor = {
            container,
            options,
            element: root,
            setValue: vi.fn<(value: string) => void>(),
            insertPaletteItem: vi.fn<(item: { label: string; snippet: string }) => void>(),
            destroy: vi.fn(() => root.remove()),
        };
        state.editors.push(editor);
        return editor;
    };

    return { state, createDiagramRenderer, createDiagramEditor };
});

vi.mock("@meldrift/diagram-engine", () => ({
    createDiagramRenderer: engine.createDiagramRenderer,
    createDiagramEditor: engine.createDiagramEditor,
}));

import MermaidCard from "@meldrift/ui/MermaidCard";

const initialSource = `flowchart LR\n    A["Start"] --> B["End"]`;

const setMobile = (mobile: boolean) => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: mobile && query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
};

type CardProps = {
    isEditing?: boolean;
    x?: number;
    y?: number;
    onUpdate?: () => void;
    onEditingClear?: () => void;
    onGeometryChange?: () => void;
};

const createCard = ({ isEditing = true, x = 0, y = 0, onUpdate, onEditingClear, onGeometryChange }: CardProps = {}) => {
    const callback = vi.fn();

    return (
        <MermaidCard
            mermaid={{
                id: 1,
                boardId: 1,
                source: initialSource,
                x,
                y,
                z: 1,
                width: 480,
                height: 360,
            }}
            zoom={1}
            isEditing={isEditing}
            onEditing={callback}
            onEditingClear={onEditingClear ?? callback}
            onInsert={callback}
            onUpdate={onUpdate ?? callback}
            onDelete={callback}
            onGeometryChange={onGeometryChange}
            onBringToFront={callback}
            onSendToBack={callback}
        />
    );
};

describe("MermaidCard with the diagram engine", () => {
    beforeEach(() => {
        engine.state.renderers.length = 0;
        engine.state.editors.length = 0;
        setMobile(false);
    });

    it("opens the editor and the shape palette in a panel outside the card on desktop", () => {
        const { container } = render(createCard());

        const panel = screen.getByRole("region", { name: "Mermaid editor" });
        const card = container.querySelector(".mermaid-rnd-1")!;
        const [renderer] = engine.state.renderers;
        const [editor] = engine.state.editors;

        expect(card.contains(panel)).toBe(false);
        expect(card.contains(renderer.container)).toBe(true);
        expect(panel.contains(editor.container)).toBe(true);
        expect(panel.contains(renderer.palette)).toBe(true);
        expect(editor.options.value).toBe(initialSource);
    });

    it("minimizes the desktop panel without destroying the editor or ending card editing", () => {
        const onEditingClear = vi.fn();
        const onUpdate = vi.fn();
        render(createCard({ onEditingClear, onUpdate }));
        const [editor] = engine.state.editors;
        const [renderer] = engine.state.renderers;
        const minimize = screen.getByRole("button", { name: "Minimize mermaid editor" });
        const body = document.getElementById(minimize.getAttribute("aria-controls")!)!;
        const next = `${initialSource}\nB --> C`;
        act(() => editor.options.onChange?.(next));

        fireEvent.click(minimize);

        expect(screen.getByRole("heading", { name: "Mermaid Editor" })).toBeVisible();
        expect(body).not.toBeVisible();
        expect(body.contains(editor.container)).toBe(true);
        expect(body.contains(renderer.palette)).toBe(true);
        expect(screen.getByRole("button", { name: "Expand mermaid editor" })).toHaveAttribute("aria-expanded", "false");
        expect(editor.destroy).not.toHaveBeenCalled();
        expect(onUpdate).not.toHaveBeenCalled();
        expect(onEditingClear).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Expand mermaid editor" }));

        expect(body).toBeVisible();
        expect(engine.state.editors).toHaveLength(1);
        expect(engine.state.renderers).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Minimize mermaid editor" })).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(screen.getByRole("button", { name: "Close mermaid editor" }));
        expect(onUpdate).toHaveBeenCalledWith(1, 1, next, 0, 0, 480, 360);
    });

    it("can finish editing from the minimized desktop title bar", () => {
        const onUpdate = vi.fn();
        const onEditingClear = vi.fn();
        render(createCard({ onUpdate, onEditingClear }));
        fireEvent.click(screen.getByRole("button", { name: "Minimize mermaid editor" }));
        fireEvent.click(screen.getByRole("button", { name: "Close mermaid editor" }));
        expect(onUpdate).toHaveBeenCalledWith(1, 1, initialSource, 0, 0, 480, 360);
        expect(onEditingClear).toHaveBeenCalledOnce();
    });

    it("fixes the editor to the screen bottom outside the card and hides the mobile palette", () => {
        setMobile(true);
        const { container } = render(createCard());

        const card = container.querySelector(".mermaid-rnd-1")!;
        const [renderer] = engine.state.renderers;
        const [editor] = engine.state.editors;

        const panel = screen.getByRole("region", { name: "Mermaid editor" });
        expect(panel).toHaveClass("fixed", "left-4", "right-20", "bottom-[max(5rem,env(safe-area-inset-bottom))]");
        expect(card.contains(panel)).toBe(false);
        expect(card.contains(editor.container)).toBe(false);
        expect(panel.contains(editor.container)).toBe(true);
        expect(renderer.container.contains(editor.container)).toBe(false);
        expect(renderer.palette.isConnected).toBe(false);
        expect(screen.queryByRole("button", { name: "Minimize mermaid editor" })).not.toBeInTheDocument();
    });

    it("draws what is typed and inserts the chosen shape into the editor", () => {
        render(createCard());
        const [renderer] = engine.state.renderers;
        const [editor] = engine.state.editors;
        const nextSource = `${initialSource}\n    B --> C`;

        act(() => editor.options.onChange?.(nextSource));
        expect(renderer.setSource).toHaveBeenCalledWith(nextSource);

        act(() => editor.options.onCursorChange?.(4));
        expect(renderer.setCursor).toHaveBeenCalledWith(4);

        const item = { label: "Rectangle", snippet: '$ID["Text"]' };
        renderer.options.onShapeSelect?.(item);
        expect(editor.insertPaletteItem).toHaveBeenCalledWith(item);
    });

    it("writes changes made on the drawing back into the editor without drawing again", () => {
        render(createCard());
        const [renderer] = engine.state.renderers;
        const [editor] = engine.state.editors;
        const movedSource = `${initialSource}\n%% meldrift-layout: {"B":[64,85]}`;

        act(() => {
            void renderer.setSource(movedSource);
            renderer.setSource.mockClear();
            renderer.options.onLayoutChange?.(movedSource);
        });

        expect(editor.setValue).toHaveBeenCalledWith(movedSource);
        expect(renderer.setSource).not.toHaveBeenCalled();
    });

    it("saves and stops editing from the panel close button", () => {
        const onUpdate = vi.fn();
        const onEditingClear = vi.fn();
        render(createCard({ onUpdate, onEditingClear }));
        const [editor] = engine.state.editors;
        const nextSource = "sequenceDiagram\n    A->>B: Hi";

        act(() => editor.options.onChange?.(nextSource));
        fireEvent.click(screen.getByRole("button", { name: "Close mermaid editor" }));

        expect(onUpdate).toHaveBeenCalledWith(1, 1, nextSource, 0, 0, 480, 360);
        expect(onEditingClear).toHaveBeenCalled();
    });

    it("shows only the drawing while the card is not being edited", () => {
        const { container } = render(createCard({ isEditing: false }));
        const [renderer] = engine.state.renderers;

        expect(engine.state.editors).toHaveLength(0);
        expect(screen.queryByRole("region", { name: "Mermaid editor" })).not.toBeInTheDocument();
        expect(container.querySelector(".mermaid-card-diagram")).toHaveAttribute("inert");
        expect(renderer.palette.isConnected).toBe(false);
    });

    it("fits changed source and shrinks it again without growing on viewport resize", async () => {
        const onGeometryChange = vi.fn();
        const { container } = render(createCard({ x: 100, y: 20, onGeometryChange }));
        const [renderer] = engine.state.renderers;
        const [editor] = engine.state.editors;
        const card = container.querySelector<HTMLElement>(".mermaid-rnd-1")!;
        const holder = document.createElement("div");
        holder.className = "meldrift-diagram-svg";
        Object.defineProperties(holder, {
            clientWidth: { get: () => Number.parseFloat(card.style.width) - 28 },
            clientHeight: { get: () => Number.parseFloat(card.style.height) - 28 },
        });
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "-8 -8 452 332");
        let bounds = { x: 0, y: 0, width: 436, height: 316 };
        Object.defineProperty(svg, "getBBox", { value: () => bounds });
        holder.append(svg);
        act(() => renderer.canvas.append(holder));
        await waitFor(() => expect(svg.getAttribute("viewBox")).toBe("-8 -8 452 332"));
        await act(async () => { await new Promise(window.requestAnimationFrame); });
        expect(onGeometryChange).not.toHaveBeenCalled();

        bounds = { x: 0, y: 0, width: 620, height: 420 };
        act(() => editor.options.onChange?.(`${initialSource}\nB --> C`));
        await waitFor(() => expect(onGeometryChange).toHaveBeenLastCalledWith({ x: 100, y: 20, width: 664, height: 464 }));

        const commits = onGeometryChange.mock.calls.length;
        fireEvent(window, new Event("resize"));
        await act(async () => { await new Promise(window.requestAnimationFrame); });
        expect(onGeometryChange).toHaveBeenCalledTimes(commits);

        bounds = { x: 0, y: 0, width: 240, height: 180 };
        act(() => editor.options.onChange?.(initialSource));
        await waitFor(() => expect(onGeometryChange).toHaveBeenLastCalledWith({ x: 100, y: 20, width: 284, height: 224 }));
    });

    it("does not take drawing height away for the mobile editor", () => {
        setMobile(true);
        render(createCard());
        const [editor] = engine.state.editors;

        expect(editor.container).toHaveClass("h-60");
        expect(editor.container.style.height).toBe("");
    });

    it("clears the selection on the drawing and detaches the editor when editing ends", () => {
        const { rerender } = render(createCard());
        const [renderer] = engine.state.renderers;
        const [editor] = engine.state.editors;
        const keydown = vi.fn();
        renderer.canvas.addEventListener("keydown", keydown);

        rerender(createCard({ isEditing: false }));

        expect(keydown).toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
        expect(editor.destroy).toHaveBeenCalled();
        expect(renderer.palette.isConnected).toBe(false);
    });
});
