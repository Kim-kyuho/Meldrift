import { describe, expect, it } from "vitest";
import {
    boardStrokesSchema,
    createStrokeId,
    defaultPenColor,
    defaultPenWidth,
    eraseStrokesAlongPath,
    eraseStrokesInCircle,
    penColors,
    strokeToPath,
} from "@/lib/board-stroke";

const stroke = {
    id: "s1",
    color: defaultPenColor,
    width: defaultPenWidth,
    points: [[10, 20], [30, 40]],
};

describe("penColors", () => {
    it("matches the beta marker palette", () => {
        expect(penColors).toEqual([
            { name: "Ink", value: "#1f2937" },
            { name: "Red", value: "#f27f78" },
            { name: "Yellow", value: "#edc34f" },
            { name: "Green", value: "#6fba69" },
            { name: "Sky", value: "#56b2d8" },
            { name: "Blue", value: "#6678cf" },
            { name: "Purple", value: "#ab70ce" },
        ]);
    });
});

describe("boardStrokesSchema", () => {
    it("accepts a valid stroke list", () => {
        expect(boardStrokesSchema.safeParse([stroke]).success).toBe(true);
        expect(boardStrokesSchema.safeParse([]).success).toBe(true);
    });

    it("rejects a stroke with fewer than two points", () => {
        expect(boardStrokesSchema.safeParse([{ ...stroke, points: [[10, 20]] }]).success).toBe(false);
    });

    it("rejects malformed points, empty ids, and non-positive widths", () => {
        expect(boardStrokesSchema.safeParse([{ ...stroke, points: [[10], [30, 40]] }]).success).toBe(false);
        expect(boardStrokesSchema.safeParse([{ ...stroke, id: "" }]).success).toBe(false);
        expect(boardStrokesSchema.safeParse([{ ...stroke, width: 0 }]).success).toBe(false);
    });
});

describe("strokeToPath", () => {
    it("returns an empty string when there are no points", () => {
        expect(strokeToPath([])).toBe("");
    });

    it("draws a straight line for two points", () => {
        expect(strokeToPath([[10, 20], [30, 40]])).toBe("M 10 20 L 30 40");
    });

    it("smooths three or more points with quadratic curves through midpoints", () => {
        expect(strokeToPath([[0, 0], [10, 10], [20, 0]])).toBe("M 0 0 Q 10 10 15 5 L 20 0");
    });

    it("keeps every point of a long stroke in the path", () => {
        const points: [number, number][] = Array.from({ length: 20 }, (_, index) => [index, index * 2]);

        expect(strokeToPath(points).match(/Q/g)).toHaveLength(18);
    });
});

describe("eraseStrokesInCircle", () => {
    const line = {
        id: "line",
        color: defaultPenColor,
        width: defaultPenWidth,
        points: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]] as [number, number][],
    };

    it("returns the same reference when nothing is touched", () => {
        const strokes = [line];

        expect(eraseStrokesInCircle(strokes, [500, 500], 10)).toBe(strokes);
    });

    it("splits a stroke into two when the middle is erased", () => {
        const [head, tail] = eraseStrokesInCircle([line], [20, 0], 5);

        expect(head.points).toEqual([[0, 0], [10, 0]]);
        expect(tail.points).toEqual([[30, 0], [40, 0]]);
        expect(head.id).not.toBe(tail.id);
    });

    it("trims the end without splitting", () => {
        const result = eraseStrokesInCircle([line], [40, 0], 5);

        expect(result).toHaveLength(1);
        expect(result[0].points).toEqual([[0, 0], [10, 0], [20, 0], [30, 0]]);
    });

    it("drops a fragment that would be left with a single point", () => {
        const result = eraseStrokesInCircle([line], [10, 0], 5);

        expect(result).toHaveLength(1);
        expect(result[0].points).toEqual([[20, 0], [30, 0], [40, 0]]);
    });

    it("removes a stroke entirely when every point is covered", () => {
        expect(eraseStrokesInCircle([line], [20, 0], 100)).toEqual([]);
    });

    it("keeps color and width on the surviving fragments", () => {
        const result = eraseStrokesInCircle([line], [20, 0], 5);

        result.forEach((stroke) => {
            expect(stroke.color).toBe(line.color);
            expect(stroke.width).toBe(line.width);
        });
    });

    it("leaves other strokes untouched", () => {
        const other = { ...line, id: "other", points: [[100, 100], [110, 100]] as [number, number][] };
        const result = eraseStrokesInCircle([line, other], [20, 0], 5);

        expect(result.find((stroke) => stroke.id === "other")).toBe(other);
    });
});

describe("eraseStrokesAlongPath", () => {
    it("erases points between two distant pointer positions", () => {
        const line = {
            id: "line",
            color: defaultPenColor,
            width: defaultPenWidth,
            points: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]] as [number, number][],
        };

        expect(eraseStrokesAlongPath([line], [5, 0], [35, 0], 2)).toEqual([]);
    });
});

describe("createStrokeId", () => {
    it("does not depend on crypto.randomUUID", () => {
        expect(typeof createStrokeId()).toBe("string");
        expect(createStrokeId().length).toBeGreaterThan(0);
    });

    it("produces different ids on repeated calls", () => {
        const ids = new Set(Array.from({ length: 50 }, () => createStrokeId()));

        expect(ids.size).toBe(50);
    });
});
