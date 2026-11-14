import { describe, expect, it } from "vitest";
import { splitMermaidSections } from "../src/features/markdown/mermaid-sections";

describe("splitMermaidSections 동작", () => {
    it("일반 마크다운을 그대로 유지한다", () => {
        expect(splitMermaidSections("")).toEqual([""]);
        expect(splitMermaidSections("# Title\n```js\nconst x = 1;\n```"))
            .toEqual(["# Title\n```js\nconst x = 1;\n```"]);
    });

    it("마크다운과 여러 Mermaid 구간을 번갈아 분리한다", () => {
        expect(splitMermaidSections("Intro\n```mermaid\nA-->B\n```\nMiddle\n```mermaid\nB-->C\n```\nEnd"))
            .toEqual(["Intro\n", "A-->B\n", "\nMiddle\n", "B-->C\n", "\nEnd"]);
        expect(splitMermaidSections("```mermaid\n```"))
            .toEqual(["", "", ""]);
    });

    it("머리글 공백과 CRLF 처리를 유지한다", () => {
        expect(splitMermaidSections("```mermaid \t\r\n\n  A-->B\r\n```"))
            .toEqual(["", "  A-->B\r\n", ""]);
    });

    it("잘못된 머리글과 닫히지 않은 블록은 마크다운으로 남긴다", () => {
        const markdown = "```mermaid A-->B```\n```mermaid\nA-->B";
        expect(splitMermaidSections(markdown)).toEqual([markdown]);
        expect(splitMermaidSections("```mermaidX\n```\n```mermaid\nA-->B```"))
            .toEqual(["```mermaidX\n```\n", "A-->B", ""]);
    });

    it("닫는 코드 울타리가 없는 긴 공백 입력을 처리한다", () => {
        const markdown = "```mermaid\n" + "\n ".repeat(200_000);
        expect(splitMermaidSections(markdown)).toEqual([markdown]);
    });

    it("유효한 블록 앞에 잘못된 코드 울타리가 많아도 처리한다", () => {
        const prefix = "```mermaid ".repeat(20_000);
        expect(splitMermaidSections(prefix + "```mermaid\nA-->B```"))
            .toEqual([prefix, "A-->B", ""]);
    });
});
