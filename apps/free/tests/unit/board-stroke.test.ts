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
} from "@meldrift/core/board-stroke";

const stroke = {
    id: "s1",
    color: defaultPenColor,
    width: defaultPenWidth,
    points: [[10, 20], [30, 40]],
};

describe("penColors 동작", () => {
    it("베타 마커 색상 팔레트와 일치한다", () => {
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

describe("boardStrokesSchema 동작", () => {
    it("유효한 획 목록을 허용한다", () => {
        expect(boardStrokesSchema.safeParse([stroke]).success).toBe(true);
        expect(boardStrokesSchema.safeParse([]).success).toBe(true);
    });

    it("점이 두 개 미만인 획을 거부한다", () => {
        expect(boardStrokesSchema.safeParse([{ ...stroke, points: [[10, 20]] }]).success).toBe(false);
    });

    it("잘못된 점·빈 식별자·양수가 아닌 굵기를 거부한다", () => {
        expect(boardStrokesSchema.safeParse([{ ...stroke, points: [[10], [30, 40]] }]).success).toBe(false);
        expect(boardStrokesSchema.safeParse([{ ...stroke, id: "" }]).success).toBe(false);
        expect(boardStrokesSchema.safeParse([{ ...stroke, width: 0 }]).success).toBe(false);
    });
});

describe("strokeToPath 동작", () => {
    it("점이 없으면 빈 문자열을 반환한다", () => {
        expect(strokeToPath([])).toBe("");
    });

    it("점이 두 개이면 직선을 그린다", () => {
        expect(strokeToPath([[10, 20], [30, 40]])).toBe("M 10 20 L 30 40");
    });

    it("점이 세 개 이상이면 중간점을 지나는 이차 곡선으로 부드럽게 연결한다", () => {
        expect(strokeToPath([[0, 0], [10, 10], [20, 0]])).toBe("M 0 0 Q 10 10 15 5 L 20 0");
    });

    it("긴 획의 모든 점을 경로에 유지한다", () => {
        const points: [number, number][] = Array.from({ length: 20 }, (_, index) => [index, index * 2]);

        expect(strokeToPath(points).match(/Q/g)).toHaveLength(18);
    });
});

describe("eraseStrokesInCircle 동작", () => {
    const line = {
        id: "line",
        color: defaultPenColor,
        width: defaultPenWidth,
        points: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]] as [number, number][],
    };

    it("아무 획에도 닿지 않으면 같은 참조를 반환한다", () => {
        const strokes = [line];

        expect(eraseStrokesInCircle(strokes, [500, 500], 10)).toBe(strokes);
    });

    it("중간을 지우면 획을 두 조각으로 나눈다", () => {
        const [head, tail] = eraseStrokesInCircle([line], [20, 0], 5);

        expect(head.points).toEqual([[0, 0], [10, 0]]);
        expect(tail.points).toEqual([[30, 0], [40, 0]]);
        expect(head.id).not.toBe(tail.id);
    });

    it("획을 나누지 않고 끝부분을 잘라낸다", () => {
        const result = eraseStrokesInCircle([line], [40, 0], 5);

        expect(result).toHaveLength(1);
        expect(result[0].points).toEqual([[0, 0], [10, 0], [20, 0], [30, 0]]);
    });

    it("점 하나만 남는 조각은 제거한다", () => {
        const result = eraseStrokesInCircle([line], [10, 0], 5);

        expect(result).toHaveLength(1);
        expect(result[0].points).toEqual([[20, 0], [30, 0], [40, 0]]);
    });

    it("모든 점이 지워지면 획 전체를 제거한다", () => {
        expect(eraseStrokesInCircle([line], [20, 0], 100)).toEqual([]);
    });

    it("남은 조각의 색상과 굵기를 유지한다", () => {
        const result = eraseStrokesInCircle([line], [20, 0], 5);

        result.forEach((stroke) => {
            expect(stroke.color).toBe(line.color);
            expect(stroke.width).toBe(line.width);
        });
    });

    it("다른 획은 변경하지 않는다", () => {
        const other = { ...line, id: "other", points: [[100, 100], [110, 100]] as [number, number][] };
        const result = eraseStrokesInCircle([line, other], [20, 0], 5);

        expect(result.find((stroke) => stroke.id === "other")).toBe(other);
    });
});

describe("eraseStrokesAlongPath 동작", () => {
    it("멀리 떨어진 두 포인터 위치 사이의 점을 지운다", () => {
        const line = {
            id: "line",
            color: defaultPenColor,
            width: defaultPenWidth,
            points: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]] as [number, number][],
        };

        expect(eraseStrokesAlongPath([line], [5, 0], [35, 0], 2)).toEqual([]);
    });
});

describe("createStrokeId 동작", () => {
    it("crypto.randomUUID에 의존하지 않는다", () => {
        expect(typeof createStrokeId()).toBe("string");
        expect(createStrokeId().length).toBeGreaterThan(0);
    });

    it("반복 호출할 때 서로 다른 식별자를 생성한다", () => {
        const ids = new Set(Array.from({ length: 50 }, () => createStrokeId()));

        expect(ids.size).toBe(50);
    });
});
