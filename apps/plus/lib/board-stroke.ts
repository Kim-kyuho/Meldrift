import { z } from "zod";

const strokePointSchema = z.tuple([z.number(), z.number()]);

const boardStrokeSchema = z.object({
    id: z.string().min(1),
    color: z.string().min(1),
    width: z.number().positive(),
    points: z.array(strokePointSchema).min(2),
});

export const boardStrokesSchema = z.array(boardStrokeSchema);

export type StrokePoint = z.infer<typeof strokePointSchema>;
export type BoardStroke = z.infer<typeof boardStrokeSchema>;

export const penColors = [
    { name: "Ink", value: "#1f2937" },
    { name: "Red", value: "#f27f78" },
    { name: "Yellow", value: "#edc34f" },
    { name: "Green", value: "#6fba69" },
    { name: "Sky", value: "#56b2d8" },
    { name: "Blue", value: "#6678cf" },
    { name: "Purple", value: "#ab70ce" },
];

export const penWidths = [
    { name: "Thin", value: 2 },
    { name: "Medium", value: 4 },
    { name: "Bold", value: 8 },
];

export const defaultPenColor = penColors[0].value;
export const defaultPenWidth = penWidths[1].value;

export const eraserScreenRadius = 8;

export const createStrokeId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const getDistanceToSegmentSquared = (
    point: StrokePoint,
    start: StrokePoint,
    end: StrokePoint,
) => {
    const segmentX = end[0] - start[0];
    const segmentY = end[1] - start[1];
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

    if (segmentLengthSquared === 0) {
        return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
    }

    const projection = Math.max(
        0,
        Math.min(
            1,
            ((point[0] - start[0]) * segmentX + (point[1] - start[1]) * segmentY) /
                segmentLengthSquared,
        ),
    );
    const closestX = start[0] + projection * segmentX;
    const closestY = start[1] + projection * segmentY;

    return (point[0] - closestX) ** 2 + (point[1] - closestY) ** 2;
};

export const eraseStrokesAlongPath = (
    strokes: BoardStroke[],
    start: StrokePoint,
    end: StrokePoint,
    radius: number,
) => {
    const nextStrokes: BoardStroke[] = [];
    let erasedAny = false;

    strokes.forEach((stroke) => {
        const survivingRuns: StrokePoint[][] = [];
        let currentRun: StrokePoint[] = [];
        const effectiveRadius = radius + stroke.width / 2;
        const radiusSquared = effectiveRadius * effectiveRadius;

        stroke.points.forEach((point) => {
            const distanceSquared = getDistanceToSegmentSquared(point, start, end);

            if (distanceSquared <= radiusSquared) {
                if (currentRun.length > 0) {
                    survivingRuns.push(currentRun);
                    currentRun = [];
                }
                return;
            }

            currentRun.push(point);
        });

        if (currentRun.length > 0) {
            survivingRuns.push(currentRun);
        }

        const survivingCount = survivingRuns.reduce((total, run) => total + run.length, 0);

        if (survivingCount === stroke.points.length) {
            nextStrokes.push(stroke);
            return;
        }

        erasedAny = true;

        survivingRuns.forEach((points, runIndex) => {
            if (points.length < 2) {
                return;
            }

            nextStrokes.push({
                ...stroke,
                id: runIndex === 0 ? stroke.id : createStrokeId(),
                points,
            });
        });
    });

    return erasedAny ? nextStrokes : strokes;
};

export const eraseStrokesInCircle = (
    strokes: BoardStroke[],
    center: StrokePoint,
    radius: number,
) => eraseStrokesAlongPath(strokes, center, center, radius);

export const strokeToPath = (points: StrokePoint[]) => {
    if (points.length === 0) {
        return "";
    }

    const [firstX, firstY] = points[0];

    if (points.length === 1) {
        return `M ${firstX} ${firstY}`;
    }

    if (points.length === 2) {
        const [lastX, lastY] = points[1];
        return `M ${firstX} ${firstY} L ${lastX} ${lastY}`;
    }

    let path = `M ${firstX} ${firstY}`;

    for (let index = 1; index < points.length - 1; index += 1) {
        const [controlX, controlY] = points[index];
        const [nextX, nextY] = points[index + 1];

        path += ` Q ${controlX} ${controlY} ${(controlX + nextX) / 2} ${(controlY + nextY) / 2}`;
    }

    const [lastX, lastY] = points[points.length - 1];
    path += ` L ${lastX} ${lastY}`;

    return path;
};
