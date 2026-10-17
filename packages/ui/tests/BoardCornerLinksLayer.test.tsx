import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BoardCornerLinksLayer from "../src/features/board/BoardCornerLinksLayer";
import { resolveMemoCornerLinks } from "@meldrift/core/cards";

describe("BoardCornerLinksLayer", () => {
    it("renders nothing when there are no corner links", () => {
        const { container } = render(<BoardCornerLinksLayer links={[]} />);

        expect(container.querySelector("[data-board-corner-links]")).toBeNull();
    });

    it("renders dashed connector lines only for non-overlapping connected cards", () => {
        const links = resolveMemoCornerLinks(
            [{ id: 1, sortOrder: 1, x: 100, y: 100, width: 200, height: 150 }],
            [
                { type: "mermaid", id: 2, x: 330, y: 100, z: 3, width: 120, height: 100 },
                { type: "table", id: 3, x: 276, y: 226, z: 4, width: 120, height: 100 },
            ],
        );

        const { container } = render(<BoardCornerLinksLayer links={links} />);
        const svg = container.querySelector('svg[data-board-corner-links="true"]');
        const lines = container.querySelectorAll("line");

        expect(svg).not.toBeNull();
        expect(lines).toHaveLength(1);
        expect(lines[0].getAttribute("stroke")).toBe("#000000");
        expect(lines[0].getAttribute("stroke-width")).toBe("1");
        expect(lines[0].getAttribute("stroke-dasharray")).toBe("4 3");
        expect(lines[0].getAttribute("x1")).toBe("300");
        expect(lines[0].getAttribute("y1")).toBe("100");
        expect(lines[0].getAttribute("x2")).toBe("330");
        expect(lines[0].getAttribute("y2")).toBe("100");
    });
});

