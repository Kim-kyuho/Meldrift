import { beforeEach, describe, expect, it, vi } from "vitest";

// Gemini 호출은 네트워크로 나가므로 SDK를 통째로 갈아끼운다.
// vi.mock은 끌어올려지기 때문에 목 함수는 vi.hoisted로 먼저 만든다.
const { generateContent, GoogleGenAIMock } = vi.hoisted(() => {
    const generateContent = vi.fn();

    // new로 불리므로 화살표 함수를 쓸 수 없다.
    return {
        generateContent,
        GoogleGenAIMock: vi.fn(function () {
            return { models: { generateContent } };
        }),
    };
});

vi.mock("@google/genai", () => ({ GoogleGenAI: GoogleGenAIMock }));

import {
    AssistantUnavailableError,
    assistantModels,
    createAssistantSystemPrompt,
    createBoardCardsToolName,
    deleteBoardCardsToolName,
    editBoardCardsToolName,
    rearrangeBoardCardsToolName,
    runBoardAssistant,
    type AssistantProduct,
    type BoardSnapshot,
} from "../src/assistant";

const product: AssistantProduct = {
    intro: ["Meldrift Free Edition이다.", "브라우저 저장소만 쓴다."],
    imageRules: ["- 그림은 만들지 못한다고 답한다."],
    usageRules: ["- 사용법은 도움말 모달을 안내한다."],
    guide: "사용법 본문",
};

const emptySnapshot: BoardSnapshot = {
    memos: [],
    mermaids: [],
    tables: [],
    images: [],
    capacity: 12,
};

const filledSnapshot: BoardSnapshot = {
    memos: [{ id: 7, summary: "회고 개요" }],
    mermaids: [{ id: 8, summary: "flowchart" }],
    tables: [],
    images: [{ id: 9, summary: "screenshot.png" }],
    capacity: 3,
};

// 모델이 도구를 호출했을 때 SDK가 돌려주는 모양.
const respondWith = (functionCalls: { name: string; args?: unknown }[], text?: string) => ({
    text,
    functionCalls,
});

const validPlanArgs = {
    sections: [
        { blocks: [{ type: "paragraph", text: "첫 섹션" }] },
        { blocks: [{ type: "heading", level: 2, text: "둘째 섹션" }] },
    ],
};

const validArrangementArgs = { sections: [{ memoId: 7 }] };

const validEditArgs = {
    memos: [{ id: 7, blocks: [{ type: "paragraph", text: "고친 본문" }] }],
    mermaids: [{ id: 8, source: "flowchart TD" }],
};

const validDeletionArgs = { memoIds: [7, 11], mermaidIds: [8] };

// 재시도 판정에는 HTTP 코드와 상태 문자열이라는 두 갈래가 있다.
// 한 픽스처에 둘 다 담으면 한쪽이 죽어도 테스트가 통과하므로 갈래마다 따로 만든다.
const retryableCodeError = new Error('{"error":{"code":503,"message":"model overloaded"}}');
const retryableStatusError = new Error("UNAVAILABLE: the model is temporarily down");
const quotaCodeError = new Error('{"error":{"code":429,"message":"too many requests"}}');
const quotaStatusError = new Error("RESOURCE_EXHAUSTED: free tier quota used up");
const fatalError = new Error('{"error":{"code":400,"message":"bad request"}}');

// GEMINI_MODEL은 모듈을 읽는 시점에 한 번만 반영되므로 다시 불러와야 확인할 수 있다.
const loadAssistantModels = async (model?: string) => {
    vi.stubEnv("GEMINI_MODEL", model as string);
    vi.resetModules();

    const loaded = await import("../src/assistant");

    vi.unstubAllEnvs();
    vi.resetModules();

    return loaded.assistantModels;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("assistantModels", () => {
    it("할당량이 여유로운 모델을 먼저 시도한다", async () => {
        await expect(loadAssistantModels()).resolves.toEqual([
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.7-flash",
            "gemini-flash-latest",
        ]);
    });

    it("GEMINI_MODEL을 맨 앞에 두고 뒤쪽 중복은 지운다", async () => {
        const models = await loadAssistantModels("gemini-3.7-flash");

        expect(models[0]).toBe("gemini-3.7-flash");
        expect(models.filter((model) => model === "gemini-3.7-flash")).toHaveLength(1);
        expect(models).toHaveLength(4);
    });

    it("목록에 없는 모델을 지정하면 폴백 앞에 붙는다", async () => {
        const models = await loadAssistantModels("gemini-experimental");

        expect(models[0]).toBe("gemini-experimental");
        expect(models).toHaveLength(5);
    });
});

describe("createAssistantSystemPrompt", () => {
    it("제품마다 다른 조각을 그대로 끼워 넣는다", () => {
        const prompt = createAssistantSystemPrompt(product);

        expect(prompt).toContain("Meldrift Free Edition이다.");
        expect(prompt).toContain("브라우저 저장소만 쓴다.");
        expect(prompt).toContain("- 그림은 만들지 못한다고 답한다.");
        expect(prompt).toContain("- 사용법은 도움말 모달을 안내한다.");
        expect(prompt).toContain("사용법 본문");
    });

    it("제품 소개를 맨 앞에, 사용법 본문을 맨 뒤에 둔다", () => {
        const lines = createAssistantSystemPrompt(product).split("\n");

        expect(lines[0]).toBe("Meldrift Free Edition이다.");
        expect(lines.at(-1)).toBe("사용법 본문");
    });

    it("네 도구를 모두 이름으로 지시한다", () => {
        const prompt = createAssistantSystemPrompt(product);

        for (const toolName of [
            createBoardCardsToolName,
            rearrangeBoardCardsToolName,
            editBoardCardsToolName,
            deleteBoardCardsToolName,
        ]) {
            expect(prompt).toContain(toolName);
        }
    });

    it("좌표를 모델이 정하지 못하게 막는다", () => {
        expect(createAssistantSystemPrompt(product)).toContain("좌표(x, y)는 절대 지정하지 않는다");
    });
});

describe("runBoardAssistant 요청 구성", () => {
    it("받은 API 키로 클라이언트를 만든다", async () => {
        generateContent.mockResolvedValue(respondWith([], "네"));

        await runBoardAssistant("test-key", [{ role: "user", content: "안녕" }], emptySnapshot, product);

        expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    });

    it("assistant 역할을 Gemini의 model 역할로 바꾼다", async () => {
        generateContent.mockResolvedValue(respondWith([], "네"));

        await runBoardAssistant(
            "test-key",
            [
                { role: "user", content: "회고 만들어줘" },
                { role: "assistant", content: "어떤 회고인가요?" },
                { role: "user", content: "스프린트 회고" },
            ],
            emptySnapshot,
            product
        );

        expect(generateContent.mock.calls[0][0].contents).toEqual([
            { role: "user", parts: [{ text: "회고 만들어줘" }] },
            { role: "model", parts: [{ text: "어떤 회고인가요?" }] },
            { role: "user", parts: [{ text: "스프린트 회고" }] },
        ]);
    });

    it("현재 보드의 카드 ID와 남은 자리를 시스템 지시에 싣는다", async () => {
        generateContent.mockResolvedValue(respondWith([], "네"));

        await runBoardAssistant("test-key", [{ role: "user", content: "정리해줘" }], filledSnapshot, product);

        const { systemInstruction } = generateContent.mock.calls[0][0].config;

        expect(systemInstruction).toContain("현재 보드 상태:");
        expect(systemInstruction).toContain("- id 7: 회고 개요");
        expect(systemInstruction).toContain("- id 8: flowchart");
        expect(systemInstruction).toContain("- id 9: screenshot.png");
        expect(systemInstruction).toContain("표 카드: 없음");
        expect(systemInstruction).toContain("최대 3개다");
    });

    it("빈 보드는 모든 종류를 없음으로 알린다", async () => {
        generateContent.mockResolvedValue(respondWith([], "네"));

        await runBoardAssistant("test-key", [{ role: "user", content: "안녕" }], emptySnapshot, product);

        const { systemInstruction } = generateContent.mock.calls[0][0].config;

        expect(systemInstruction).toContain("메모 카드: 없음");
        expect(systemInstruction).toContain("Mermaid 카드: 없음");
        expect(systemInstruction).toContain("표 카드: 없음");
        expect(systemInstruction).toContain("이미지 카드: 없음");
    });

    it("네 개의 함수 선언을 도구로 넘긴다", async () => {
        generateContent.mockResolvedValue(respondWith([], "네"));

        await runBoardAssistant("test-key", [{ role: "user", content: "안녕" }], emptySnapshot, product);

        const declarations = generateContent.mock.calls[0][0].config.tools[0].functionDeclarations;

        expect(declarations.map((declaration: { name: string }) => declaration.name)).toEqual([
            createBoardCardsToolName,
            rearrangeBoardCardsToolName,
            editBoardCardsToolName,
            deleteBoardCardsToolName,
        ]);
    });
});

describe("모델 폴백", () => {
    const runOnce = () =>
        runBoardAssistant("test-key", [{ role: "user", content: "안녕" }], emptySnapshot, product);

    it("혼잡한 모델을 만나면 다음 모델로 넘어간다", async () => {
        generateContent
            .mockRejectedValueOnce(retryableCodeError)
            .mockResolvedValueOnce(respondWith([], "두 번째 모델의 답"));

        const result = await runOnce();

        expect(result.reply).toBe("두 번째 모델의 답");
        expect(generateContent).toHaveBeenCalledTimes(2);
        expect(generateContent.mock.calls[0][0].model).toBe(assistantModels[0]);
        expect(generateContent.mock.calls[1][0].model).toBe(assistantModels[1]);
    });

    // HTTP 코드로만 판정되는 실패. 상태 문자열 쪽 판정이 사라져도 여기서 걸린다.
    it.each([500, 503, 429])("코드 %i만 보고도 다음 모델을 시도한다", async (code) => {
        generateContent
            .mockRejectedValueOnce(new Error(`{"error":{"code":${code},"message":"try later"}}`))
            .mockResolvedValueOnce(respondWith([], "다음 모델"));

        await expect(runOnce()).resolves.toMatchObject({ reply: "다음 모델" });
        expect(generateContent).toHaveBeenCalledTimes(2);
    });

    // 상태 문자열로만 판정되는 실패. 코드 쪽 판정이 사라져도 여기서 걸린다.
    it.each(["UNAVAILABLE", "RESOURCE_EXHAUSTED", "INTERNAL", "NOT_FOUND"])(
        "%s 상태만 보고도 다음 모델을 시도한다",
        async (status) => {
            generateContent
                .mockRejectedValueOnce(new Error(`${status}: something went wrong`))
                .mockResolvedValueOnce(respondWith([], "다음 모델"));

            await expect(runOnce()).resolves.toMatchObject({ reply: "다음 모델" });
            expect(generateContent).toHaveBeenCalledTimes(2);
        }
    );

    it("잘못된 요청은 다시 시도하지 않고 그대로 던진다", async () => {
        generateContent.mockRejectedValue(fatalError);

        await expect(runOnce()).rejects.toBe(fatalError);
        expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it("모든 모델이 혼잡하면 잠시 뒤 다시 시도하라고 알린다", async () => {
        generateContent.mockRejectedValue(retryableCodeError);

        await expect(runOnce()).rejects.toThrow(AssistantUnavailableError);
        await expect(runOnce()).rejects.toThrow(/busy right now/);
        expect(generateContent).toHaveBeenCalledTimes(assistantModels.length * 2);
    });

    it("상태 문자열로만 알 수 있는 혼잡도 같은 문구로 알린다", async () => {
        generateContent.mockRejectedValue(retryableStatusError);

        await expect(runOnce()).rejects.toThrow(/busy right now/);
    });

    // 혼잡은 기다리면 풀리지만 쿼터는 결제나 초기화를 기다려야 해서 안내가 달라야 한다.
    it("코드 429는 쿼터 소진으로 안내한다", async () => {
        generateContent.mockRejectedValue(quotaCodeError);

        await expect(runOnce()).rejects.toThrow(/daily AI quota/);
    });

    it("RESOURCE_EXHAUSTED 상태도 쿼터 소진으로 안내한다", async () => {
        generateContent.mockRejectedValue(quotaStatusError);

        await expect(runOnce()).rejects.toThrow(/daily AI quota/);
    });
});

describe("도구 호출 우선순위", () => {
    // 파괴적인 순서로 본다. 삭제 > 고치기 > 재배치 > 생성.
    it("여러 도구를 한꺼번에 부르면 삭제를 먼저 잡는다", async () => {
        generateContent.mockResolvedValue(
            respondWith([
                { name: createBoardCardsToolName, args: validPlanArgs },
                { name: rearrangeBoardCardsToolName, args: validArrangementArgs },
                { name: editBoardCardsToolName, args: validEditArgs },
                { name: deleteBoardCardsToolName, args: validDeletionArgs },
            ])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "지워줘" }],
            filledSnapshot,
            product
        );

        expect(result.deletion).toEqual(validDeletionArgs);
        expect(result.edit).toBeNull();
        expect(result.arrangement).toBeNull();
        expect(result.plan).toBeNull();
        expect(result.reply).toBe("Removed 3 card(s). You can undo this before saving.");
    });

    it("고치기는 재배치와 생성보다 앞선다", async () => {
        generateContent.mockResolvedValue(
            respondWith([
                { name: createBoardCardsToolName, args: validPlanArgs },
                { name: rearrangeBoardCardsToolName, args: validArrangementArgs },
                { name: editBoardCardsToolName, args: validEditArgs },
            ])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "고쳐줘" }],
            filledSnapshot,
            product
        );

        expect(result.edit).toEqual(validEditArgs);
        expect(result.arrangement).toBeNull();
        expect(result.plan).toBeNull();
        expect(result.reply).toBe("Updated 2 card(s). Review them and save.");
    });

    it("재배치는 생성보다 앞선다", async () => {
        generateContent.mockResolvedValue(
            respondWith([
                { name: createBoardCardsToolName, args: validPlanArgs },
                { name: rearrangeBoardCardsToolName, args: validArrangementArgs },
            ])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "정리해줘" }],
            filledSnapshot,
            product
        );

        expect(result.arrangement).toEqual(validArrangementArgs);
        expect(result.plan).toBeNull();
        expect(result.reply).toBe("Rearranged the cards. Review them and save.");
    });

    it("생성만 부르면 섹션 수를 세어 알린다", async () => {
        generateContent.mockResolvedValue(
            respondWith([{ name: createBoardCardsToolName, args: validPlanArgs }])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "회고 만들어줘" }],
            emptySnapshot,
            product
        );

        expect(result.plan).toEqual(validPlanArgs);
        expect(result.reply).toBe("Created 2 card(s). Review them and save.");
    });
});

describe("모델이 스키마를 벗어났을 때", () => {
    it("지울 대상이 비면 지우지 않고 되묻는다", async () => {
        generateContent.mockResolvedValue(respondWith([{ name: deleteBoardCardsToolName, args: {} }]));

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "정리해줘" }],
            filledSnapshot,
            product
        );

        expect(result.deletion).toBeNull();
        expect(result.reply).toBe("I could not tell which cards to delete. Please name them.");
    });

    it("삭제 인자의 타입이 어긋나도 되묻는다", async () => {
        generateContent.mockResolvedValue(
            respondWith([{ name: deleteBoardCardsToolName, args: { memoIds: ["일곱"] } }])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "지워줘" }],
            filledSnapshot,
            product
        );

        expect(result.deletion).toBeNull();
        expect(result.reply).toBe("I could not tell which cards to delete. Please name them.");
    });

    it("삭제 인자가 잘못되면 모델의 답변으로 덮어쓰지 않는다", async () => {
        generateContent.mockResolvedValue(
            respondWith([{ name: deleteBoardCardsToolName, args: {} }], "다 지웠습니다")
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "지워줘" }],
            filledSnapshot,
            product
        );

        expect(result.reply).toBe("I could not tell which cards to delete. Please name them.");
    });

    it("고칠 카드가 없으면 다시 시도하라고 답한다", async () => {
        generateContent.mockResolvedValue(respondWith([{ name: editBoardCardsToolName, args: {} }]));

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "고쳐줘" }],
            filledSnapshot,
            product
        );

        expect(result.edit).toBeNull();
        expect(result.reply).toBe("I could not understand the edit. Please try again.");
    });

    it("존재할 수 없는 카드 ID로 고치려 하면 거른다", async () => {
        generateContent.mockResolvedValue(
            respondWith([{ name: editBoardCardsToolName, args: { memos: [{ id: 0 }] } }])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "고쳐줘" }],
            filledSnapshot,
            product
        );

        expect(result.edit).toBeNull();
        expect(result.reply).toBe("I could not understand the edit. Please try again.");
    });

    it("빈 재배치 계획은 받지 않는다", async () => {
        generateContent.mockResolvedValue(
            respondWith([{ name: rearrangeBoardCardsToolName, args: { sections: [] } }])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "정리해줘" }],
            filledSnapshot,
            product
        );

        expect(result.arrangement).toBeNull();
        expect(result.reply).toBe("I could not understand the layout change. Please try again.");
    });

    it("본문 없는 섹션은 카드로 만들지 않는다", async () => {
        generateContent.mockResolvedValue(
            respondWith([{ name: createBoardCardsToolName, args: { sections: [{ blocks: [] }] } }])
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "만들어줘" }],
            emptySnapshot,
            product
        );

        expect(result.plan).toBeNull();
        expect(result.reply).toBe("I could not build the cards. Please describe what you need in more detail.");
    });
});

describe("도구를 부르지 않았을 때", () => {
    it("잡담에는 모델의 답을 그대로 돌려준다", async () => {
        generateContent.mockResolvedValue(respondWith([], "  안녕하세요  "));

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "안녕" }],
            emptySnapshot,
            product
        );

        expect(result).toEqual({
            reply: "안녕하세요",
            plan: null,
            arrangement: null,
            edit: null,
            deletion: null,
        });
    });

    it("답도 도구 호출도 없으면 다시 말해 달라고 한다", async () => {
        generateContent.mockResolvedValue(respondWith([], "   "));

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "안녕" }],
            emptySnapshot,
            product
        );

        expect(result.reply).toBe("I could not understand that request. Please rephrase it.");
    });

    it("functionCalls 자체가 없어도 견딘다", async () => {
        generateContent.mockResolvedValue({ text: "네" });

        await expect(
            runBoardAssistant("test-key", [{ role: "user", content: "안녕" }], emptySnapshot, product)
        ).resolves.toMatchObject({ reply: "네" });
    });

    it("모르는 이름의 도구를 부르면 무시한다", async () => {
        generateContent.mockResolvedValue(respondWith([{ name: "unknown_tool", args: {} }], "네"));

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "안녕" }],
            emptySnapshot,
            product
        );

        expect(result).toMatchObject({ reply: "네", plan: null, deletion: null });
    });

    it("모델이 답을 곁들이면 기본 문구 대신 그 답을 쓴다", async () => {
        generateContent.mockResolvedValue(
            respondWith([{ name: createBoardCardsToolName, args: validPlanArgs }], "회고 보드를 만들었어요")
        );

        const result = await runBoardAssistant(
            "test-key",
            [{ role: "user", content: "회고 만들어줘" }],
            emptySnapshot,
            product
        );

        expect(result.reply).toBe("회고 보드를 만들었어요");
        expect(result.plan).toEqual(validPlanArgs);
    });
});
