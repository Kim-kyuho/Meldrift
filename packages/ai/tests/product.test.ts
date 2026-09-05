import { describe, expect, it } from "vitest";
import { createMeldriftProduct } from "../src/product";
import { createAssistantSystemPrompt } from "../src/assistant";

describe("createMeldriftProduct", () => {
    it("앱이 넘긴 사용법 본문을 그대로 싣는다", () => {
        const guide = "## 메모\n메모는 더블클릭으로 연다.";

        expect(createMeldriftProduct("free", guide).guide).toBe(guide);
        expect(createMeldriftProduct("plus", guide).guide).toBe(guide);
    });

    it("Free는 브라우저 저장이라는 사실을 첫 문단에서 밝힌다", () => {
        const { intro } = createMeldriftProduct("free", "");

        expect(intro.join("\n")).toContain("브라우저 안의 SQLite");
    });

    it("본판은 Free Edition을 자기 이름으로 쓰지 않는다", () => {
        const { intro } = createMeldriftProduct("plus", "");

        expect(intro.join("\n")).not.toContain("Free Edition");
    });

    it("두 에디션 모두 AI 그림 생성을 거절하도록 지시한다", () => {
        for (const edition of ["free", "plus"] as const) {
            const { imageRules } = createMeldriftProduct(edition, "");

            expect(imageRules.join("\n")).toContain("만들 수 없다");
        }
    });

    it("에디션 문구가 시스템 프롬프트에 실제로 들어간다", () => {
        const prompt = createAssistantSystemPrompt(createMeldriftProduct("free", "사용법 본문"));

        expect(prompt).toContain("Meldrift Free Edition의 AI 어시스턴트");
        expect(prompt).toContain("사용법 본문");
    });
});
