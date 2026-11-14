export type DiagramRect = { x: number; y: number; width: number; height: number };
export type DiagramFit = { width: number; height: number; dx: number; dy: number };

const margin = 8;
export const mermaidMinSize = 180;

export function paddedDiagramBounds(bounds: DiagramRect): DiagramRect | null {
    if (!Object.values(bounds).every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
        return null;
    }
    return { x: bounds.x - margin, y: bounds.y - margin, width: bounds.width + margin * 2, height: bounds.height + margin * 2 };
}

export function fitReadOnlyDiagram(host: ParentNode) {
    const svg = host.querySelector<SVGSVGElement>(".meldrift-diagram-svg > svg");
    if (!svg || typeof svg.getBBox !== "function") {
        return;
    }
    try {
        const box = svg.getBBox();
        const view = paddedDiagramBounds({ x: box.x, y: box.y, width: box.width, height: box.height });
        if (view) {
            svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
        }
    } catch {
        // Detached or hidden SVGs may not have measurable geometry yet.
    }
}

export function fitDiagramBounds(
    bounds: DiagramRect,
    view: DiagramRect,
    viewport: { width: number; height: number },
    card: { width: number; height: number },
    scale: number,
    keepPosition: boolean,
): { view: DiagramRect; card: DiagramFit } | null {
    const content = paddedDiagramBounds(bounds);
    if (!content || !Number.isFinite(scale) || scale <= 0 || viewport.width <= 0 || viewport.height <= 0) {
        return null;
    }
    const insetWidth = Math.max(0, card.width - viewport.width);
    const insetHeight = Math.max(0, card.height - viewport.height);
    const width = Math.max(mermaidMinSize, Math.ceil(content.width * scale + insetWidth));
    const height = Math.max(mermaidMinSize, Math.ceil(content.height * scale + insetHeight));
    const nextView = {
        x: content.x - ((width - insetWidth) / scale - content.width) / 2,
        y: content.y - ((height - insetHeight) / scale - content.height) / 2,
        width: (width - insetWidth) / scale,
        height: (height - insetHeight) / scale,
    };
    return {
        view: nextView,
        card: {
            width, height,
            dx: keepPosition ? (viewport.width - view.width * scale) / 2 + (nextView.x - view.x) * scale : 0,
            dy: keepPosition ? (viewport.height - view.height * scale) / 2 + (nextView.y - view.y) * scale : 0,
        },
    };
}
