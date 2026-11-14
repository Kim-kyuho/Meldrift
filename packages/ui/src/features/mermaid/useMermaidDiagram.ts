import { useEffect, useRef, useState } from "react";
import {
    createDiagramEditor,
    createDiagramRenderer,
    type DiagramEditor,
    type DiagramRenderer,
} from "@meldrift/diagram-engine";
import { fitDiagramBounds, paddedDiagramBounds, type DiagramFit, type DiagramRect } from "./mermaid-layout";

type UseMermaidDiagramOptions = {
    source: string;
    isEditing: boolean;
    autoFit: boolean;
    fitInitial: boolean;
    cardSize: { width: number; height: number };
    onSourceChange: (source: string) => void;
    onFit: (fit: DiagramFit) => void;
};

const viewOf = (svg: SVGSVGElement): DiagramRect | null => {
    const values = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
    return values?.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0
        ? { x: values[0], y: values[1], width: values[2], height: values[3] } : null;
};
const setView = (svg: SVGSVGElement, view: DiagramRect) =>
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);

export function useMermaidDiagram(options: UseMermaidDiagramOptions) {
    const { source, isEditing } = options;
    const [rendererHost, setRendererHost] = useState<HTMLDivElement | null>(null);
    const [editorHost, setEditorHost] = useState<HTMLDivElement | null>(null);
    const [paletteHost, setPaletteHost] = useState<HTMLDivElement | null>(null);
    const rendererRef = useRef<DiagramRenderer | null>(null);
    const editorRef = useRef<DiagramEditor | null>(null);
    const paletteRef = useRef<HTMLElement | null>(null);
    const sourceRef = useRef(source);
    const optionsRef = useRef(options);
    const scheduleFitRef = useRef<(layout: boolean) => void>(() => {});
    const captureScaleRef = useRef(() => {});

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    useEffect(() => {
        sourceRef.current = source;
        const renderer = rendererRef.current;
        if (!renderer || renderer.getSource() === source) {
            return;
        }
        captureScaleRef.current();
        void renderer.setSource(source).then(() => {
            if (rendererRef.current === renderer) {
                scheduleFitRef.current(false);
            }
        });
    }, [source]);

    useEffect(() => {
        if (!rendererHost) {
            return;
        }

        let frame: number | null = null;
        let overlayFrame: number | null = null;
        let scale = 1;
        let initialized = false;
        let layoutChange = false;
        let active = true;
        const drawnSvg = () => rendererHost.querySelector<SVGSVGElement>(".meldrift-diagram-svg > svg");
        const captureScale = () => {
            const svg = drawnSvg();
            const view = svg && viewOf(svg);
            const holder = svg?.parentElement;
            if (view && holder?.clientWidth && holder.clientHeight) {
                scale = Math.min(holder.clientWidth / view.width, holder.clientHeight / view.height);
            }
        };
        const fit = () => {
            frame = null;
            if (!active) {
                return;
            }
            const svg = drawnSvg();
            const view = svg && viewOf(svg);
            const holder = svg?.parentElement;
            if (!svg || !view || !holder?.clientWidth || !holder.clientHeight || typeof svg.getBBox !== "function") {
                return;
            }
            let bounds: DiagramRect;
            try {
                const box = svg.getBBox();
                bounds = { x: box.x, y: box.y, width: box.width, height: box.height };
            } catch {
                return;
            }
            const current = optionsRef.current;
            // The engine has no fit API. Keep its SVG coordinates, and fit only the app-owned viewport.
            if (!current.autoFit || (!initialized && !current.fitInitial)) {
                const content = paddedDiagramBounds(bounds);
                if (content) {
                    setView(svg, content);
                    captureScale();
                }
            } else {
                const result = fitDiagramBounds(bounds, view, {
                    width: holder.clientWidth, height: holder.clientHeight,
                }, current.cardSize, scale, layoutChange);
                if (result) {
                    setView(svg, result.view);
                    current.onFit(result.card);
                }
            }
            initialized = true;
            layoutChange = false;
            if (overlayFrame !== null) {
                window.cancelAnimationFrame(overlayFrame);
            }
            overlayFrame = window.requestAnimationFrame(() => {
                overlayFrame = null;
                if (active) {
                    canvas?.dispatchEvent(new Event("scroll"));
                }
            });
        };
        const scheduleFit = (layout: boolean) => {
            if (!active) {
                return;
            }
            layoutChange ||= layout;
            if (frame !== null) {
                window.cancelAnimationFrame(frame);
            }
            if (overlayFrame !== null) {
                window.cancelAnimationFrame(overlayFrame);
            }
            frame = window.requestAnimationFrame(fit);
        };
        captureScaleRef.current = captureScale;
        scheduleFitRef.current = scheduleFit;
        const applyDrawingChange = (next: string, layout: boolean) => {
            captureScale();
            sourceRef.current = next;
            editorRef.current?.setValue(next);
            optionsRef.current.onSourceChange(next);
            if (layout) {
                scheduleFit(true);
            }
        };
        const renderer = createDiagramRenderer(rendererHost, {
            source: sourceRef.current,
            emptyText: "Mermaid source is empty.",
            onShapeSelect: (item) => editorRef.current?.insertPaletteItem(item),
            onLayoutChange: (next) => applyDrawingChange(next, true),
            onSourceChange: (next) => applyDrawingChange(next, false),
        });
        const palette = renderer.element.querySelector<HTMLElement>(".meldrift-diagram-palette");
        palette?.remove();
        rendererRef.current = renderer;
        paletteRef.current = palette;

        // Observe render completion, not container resizing: Rnd resizing must only change the scale.
        const observer = new MutationObserver(() => scheduleFit(false));
        const canvas = renderer.element.querySelector(".meldrift-diagram-canvas");
        if (canvas) {
            observer.observe(canvas, { childList: true });
        }
        scheduleFit(false);

        return () => {
            active = false;
            observer.disconnect();
            if (frame !== null) {
                window.cancelAnimationFrame(frame);
            }
            if (overlayFrame !== null) {
                window.cancelAnimationFrame(overlayFrame);
            }
            renderer.destroy();
            palette?.remove();
            rendererRef.current = null;
            paletteRef.current = null;
            scheduleFitRef.current = () => {};
            captureScaleRef.current = () => {};
        };
    }, [rendererHost]);

    useEffect(() => {
        const palette = paletteRef.current;
        if (!paletteHost || !palette) {
            return;
        }
        paletteHost.append(palette);
        return () => { palette.remove(); };
    }, [paletteHost, rendererHost]);

    useEffect(() => {
        if (!editorHost) {
            return;
        }
        const editor = createDiagramEditor(editorHost, {
            value: sourceRef.current,
            onChange: (next) => {
                captureScaleRef.current();
                optionsRef.current.onSourceChange(next);
            },
            onCursorChange: (offset) => rendererRef.current?.setCursor(offset),
        });
        editorRef.current = editor;
        return () => {
            editor.destroy();
            editorRef.current = null;
        };
    }, [editorHost]);

    useEffect(() => {
        if (!isEditing) {
            rendererRef.current?.element.querySelector<HTMLElement>(".meldrift-diagram-canvas")
                ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        }
    }, [isEditing]);

    return { setRendererHost, setEditorHost, setPaletteHost };
}
