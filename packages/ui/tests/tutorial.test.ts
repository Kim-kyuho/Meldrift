import { describe, expect, it } from "vitest";
import { compileBoardMarkdownDocument } from "@meldrift/board-data/board-markdown";
import { resolveMemoCornerLinks } from "@meldrift/core/cards";
import {
    buildTutorialShowcaseSnapshot, createTutorialSandboxSnapshot, tutorialSandboxTitle,
} from "../src/features/guide/tutorial";

const mascotUrl = "/meldrift-mascot.png";

describe("튜토리얼 스냅샷", () => {
    it("샌드박스는 빈 보드에 튜토리얼 제목을 붙인다", () => {
        const sandbox = createTutorialSandboxSnapshot();

        expect(sandbox.board.title).toBe(tutorialSandboxTitle);
        expect(sandbox.memos).toEqual([]);
    });

    it("쇼케이스 카드는 메모 꼭짓점 50px 안에 붙는다", () => {
        const showcase = buildTutorialShowcaseSnapshot({ x: 200, y: 240 }, mascotUrl, new Uint8Array([1, 2, 3]));

        expect(showcase.memos).toHaveLength(2);
        expect(showcase.images).toHaveLength(1);
        expect(showcase.tables).toHaveLength(1);
        expect(showcase.mermaids).toHaveLength(1);

        const links = resolveMemoCornerLinks(showcase.memos, [
            ...showcase.images.map((image) => ({
                type: "image" as const,
                id: image.imageId,
                x: image.x,
                y: image.y,
                z: image.z,
                width: image.width,
                height: image.height,
            })),
            ...showcase.tables.map((table) => ({
                type: "table" as const,
                id: table.id,
                x: table.x,
                y: table.y,
                z: table.z,
                width: table.width,
                height: table.height,
            })),
            ...showcase.mermaids.map((mermaid) => ({
                type: "mermaid" as const,
                id: mermaid.id,
                x: mermaid.x,
                y: mermaid.y,
                z: mermaid.z,
                width: mermaid.width,
                height: mermaid.height,
            })),
        ]);

        expect(links.length).toBeGreaterThanOrEqual(3);
    });

    it("쇼케이스 이미지는 앱이 넘긴 마스코트 경로를 쓴다", () => {
        const showcase = buildTutorialShowcaseSnapshot({ x: 200, y: 240 }, "/plus/meldrift-mascot.png");

        expect(showcase.images[0].url).toBe("/plus/meldrift-mascot.png");
    });

    it("쇼케이스를 Markdown으로 컴파일할 수 있다", () => {
        const showcase = buildTutorialShowcaseSnapshot({ x: 200, y: 240 }, mascotUrl, new Uint8Array([1, 2, 3]));

        const { markdown } = compileBoardMarkdownDocument(showcase);

        expect(markdown).toContain("# Welcome to Meldrift");
        expect(markdown).not.toContain("    \n-");
    });
});
