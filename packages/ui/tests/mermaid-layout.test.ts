import { describe, expect, it } from "vitest";
import { fitDiagramBounds, fitReadOnlyDiagram } from "../src/features/mermaid/mermaid-layout";

const view = { x: -8, y: -8, width: 452, height: 332 };
const viewport = { width: 452, height: 332 };
const card = { width: 480, height: 360 };

describe("Mermaid diagram fit", () => {
    it("grows and shrinks both dimensions at the current node scale", () => {
        const large = fitDiagramBounds({ x: 0, y: 0, width: 620, height: 420 }, view, viewport, card, 1, false)!;
        expect(large.card).toEqual({ width: 664, height: 464, dx: 0, dy: 0 });
        expect(large.view).toEqual({ x: -8, y: -8, width: 636, height: 436 });
        const small = fitDiagramBounds({ x: 0, y: 0, width: 240, height: 180 }, large.view,
            { width: 636, height: 436 }, large.card, 1, false)!;
        expect(small.card).toEqual({ width: 284, height: 224, dx: 0, dy: 0 });
    });

    it("preserves node scale and screen anchors after a node is moved left or up", () => {
        const fit = fitDiagramBounds({ x: -40, y: -30, width: 436, height: 316 }, view, viewport, card, 1, true)!;
        expect(fit.card).toEqual({ width: 480, height: 360, dx: -40, dy: -30 });
        expect(fit.view.x).toBe(-48);
        expect(fit.view.y).toBe(-38);
    });

    it("retains the user's resized scale and reserves minimum space without stretching nodes", () => {
        const fit = fitDiagramBounds({ x: 0, y: 0, width: 200, height: 20 }, view, viewport, card, 0.5, false)!;
        expect(fit.card.width).toBe(180);
        expect(fit.card.height).toBe(180);
        expect((fit.card.width - 28) / fit.view.width).toBe(0.5);
        expect((fit.card.height - 28) / fit.view.height).toBe(0.5);
    });

    it("ignores empty, invalid and unmeasured diagrams", () => {
        expect(fitDiagramBounds({ x: 0, y: 0, width: 0, height: 20 }, view, viewport, card, 1, false)).toBeNull();
        expect(fitDiagramBounds({ x: 0, y: 0, width: 20, height: 20 }, view, viewport, card, NaN, false)).toBeNull();
        expect(fitDiagramBounds({ x: 0, y: 0, width: 20, height: 20 }, view, { width: 0, height: 0 }, card, 1, false)).toBeNull();
    });

    it("fits read-only previews around moved nodes without changing source coordinates", () => {
        const host = document.createElement("div");
        host.innerHTML = '<div class="meldrift-diagram-svg"><svg viewBox="0 0 100 100"><g transform="translate(-200, 50)"></g></svg></div>';
        const svg = host.querySelector("svg")!;
        Object.defineProperty(svg, "getBBox", { value: () => ({ x: -200, y: 50, width: 500, height: 120 }) });
        fitReadOnlyDiagram(host);
        expect(svg.getAttribute("viewBox")).toBe("-208 42 516 136");
        expect(svg.querySelector("g")!.getAttribute("transform")).toBe("translate(-200, 50)");
    });
});
