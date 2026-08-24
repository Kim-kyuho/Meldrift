import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import {
    boardArrangementSchema,
    boardDeletionSchema,
    boardEditSchema,
    boardPlanSchema,
    layoutModes,
    planMemoColors,
    type BoardArrangement,
    type BoardDeletion,
    type BoardEdit,
    type BoardPlan,
} from "@/lib/ai/board-plan";
import { meldriftGuide } from "@/lib/ai/meldrift-guide";

// Gemini 호출과 도구 정의를 모아둔 라이브러리.
// 카드 생성은 자유 텍스트 파싱이 아니라 function calling으로만 받는다.
//
// Free Edition의 이미지 카드는 사용자가 고른 로컬 파일만 받는다. AI 이미지 생성은 저장 용량과
// API 비용을 별도로 제어해야 하므로 지원하지 않고, 이미지 카드는 지우기 대상으로만 다룬다.

// 선호 순서대로 시도해 첫 성공을 쓴다.
// 최신 모델일수록 무료 티어 할당량이 빡빡해 429가 먼저 난다. 그래서 최신이 아니라
// 할당량이 여유로운 쪽을 앞에 둔다. 3.7은 빠르지만 금방 막히므로 뒤로 미룬다.
// gemini-2.5-flash는 models.list에는 보이지만 generateContent가 404라 넣지 않는다.
const fallbackModels = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
];

export const assistantModels = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL, ...fallbackModels.filter((model) => model !== process.env.GEMINI_MODEL)]
    : fallbackModels;

/** 모델 혼잡이나 일시적 장애로 실패했을 때 던진다. 호출자가 503으로 응답한다. */
export class AssistantUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AssistantUnavailableError";
    }
}

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

// 다른 모델로 넘어갈 가치가 있는 실패인지 판단한다. 잘못된 요청(400)은 재시도해도 같다.
const isRetryableModelError = (error: unknown) => {
    const message = toErrorMessage(error);

    return (
        /"code":\s*(429|500|503)/.test(message) ||
        /UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|NOT_FOUND/.test(message)
    );
};

// 쿼터 소진(429)과 일시적 혼잡(503)은 사용자가 할 수 있는 일이 다르다.
// 혼잡은 잠시 뒤 재시도로 풀리지만, 쿼터는 초기화를 기다리거나 결제를 붙여야 한다.
const isQuotaError = (error: unknown) => {
    const message = toErrorMessage(error);

    return /"code":\s*429/.test(message) || /RESOURCE_EXHAUSTED/.test(message);
};

export const createBoardCardsToolName = "create_board_cards";
export const rearrangeBoardCardsToolName = "rearrange_board_cards";
export const editBoardCardsToolName = "edit_board_cards";
export const deleteBoardCardsToolName = "delete_board_cards";

const memoBlockSchema = {
    type: "object",
    properties: {
        type: {
            type: "string",
            enum: ["heading", "paragraph", "bulletList", "orderedList", "codeBlock", "blockquote"],
        },
        level: { type: "integer", minimum: 1, maximum: 6, description: "heading일 때만 사용" },
        text: { type: "string", description: "heading/paragraph/codeBlock/blockquote에서 사용" },
        items: {
            type: "array",
            items: { type: "string" },
            description: "bulletList/orderedList에서 사용",
        },
    },
    required: ["type"],
} as const;

// Gemini는 parametersJsonSchema로 일반 JSON Schema를 그대로 받는다.
export const createBoardCardsFunction: FunctionDeclaration = {
    name: createBoardCardsToolName,
    description:
        "사용자가 요청한 문서를 Meldrift 카드로 만든다. 섹션 하나가 메모 카드 하나가 되고, 섹션 순서가 곧 최종 Markdown 문서의 순서다. 표나 다이어그램이 필요한 섹션에만 attachment를 붙인다.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            layout: {
                type: "string",
                enum: [...layoutModes],
                description:
                    "배치 방식. column=한 줄기로 이어지는 문서, grid=서로 대등한 항목 나열, tree=상위-하위 구조가 있는 설계, scatter=브레인스토밍처럼 흩어 놓기. 생략하면 column",
            },
            sections: {
                type: "array",
                minItems: 1,
                maxItems: 12,
                items: {
                    type: "object",
                    properties: {
                        blocks: {
                            type: "array",
                            minItems: 1,
                            items: memoBlockSchema,
                            description: "메모 카드 본문을 이루는 블록 목록",
                        },
                        color: {
                            type: "string",
                            enum: [...planMemoColors],
                            description: "메모 카드 배경색. 생략하면 기본 노란색",
                        },
                        parentIndex: {
                            type: "integer",
                            description:
                                "tree 배치일 때만 사용. 이 섹션의 상위 섹션 인덱스(0부터). 자기보다 반드시 작아야 한다. 최상위면 생략",
                        },
                        attachment: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["mermaid", "table"] },
                                source: { type: "string", description: "mermaid일 때 Mermaid 문법" },
                                columns: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "table일 때 열 이름",
                                },
                                rows: {
                                    type: "array",
                                    items: { type: "array", items: { type: "string" } },
                                    description: "table일 때 행 데이터. 각 행의 길이는 columns와 맞춘다",
                                },
                            },
                            required: ["type"],
                        },
                    },
                    required: ["blocks"],
                },
            },
        },
        required: ["sections"],
    },
};

export const rearrangeBoardCardsFunction: FunctionDeclaration = {
    name: rearrangeBoardCardsToolName,
    description:
        "보드에 이미 있는 카드의 위치를 다시 잡는다. 카드를 새로 만들거나 내용을 바꾸지 않고 배치만 정리한다. 어떤 메모에 어떤 표/다이어그램을 붙일지 다시 정할 때도 이 함수를 쓴다. 반드시 대화에 주어진 현재 보드 카드 목록의 ID만 사용한다.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            layout: {
                type: "string",
                enum: [...layoutModes],
                description:
                    "배치 방식. column=한 줄기로 이어지는 문서, grid=서로 대등한 항목 나열, tree=상위-하위 구조가 있는 설계, scatter=브레인스토밍처럼 흩어 놓기. 생략하면 column",
            },
            sections: {
                type: "array",
                minItems: 1,
                items: {
                    type: "object",
                    properties: {
                        memoId: { type: "integer", description: "현재 보드에 있는 메모 카드 ID" },
                        parentIndex: {
                            type: "integer",
                            description:
                                "tree 배치일 때만 사용. 이 섹션의 상위 섹션 인덱스(0부터). 자기보다 반드시 작아야 한다. 최상위면 생략",
                        },
                        attachment: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["mermaid", "table"] },
                                cardId: { type: "integer", description: "현재 보드에 있는 카드 ID" },
                            },
                            required: ["type", "cardId"],
                        },
                    },
                    required: ["memoId"],
                },
            },
        },
        required: ["sections"],
    },
};

export const editBoardCardsFunction: FunctionDeclaration = {
    name: editBoardCardsToolName,
    description:
        "보드에 이미 있는 카드의 내용을 고친다. 위치와 크기는 바꾸지 않는다. 반드시 대화에 주어진 현재 보드 카드 목록의 ID만 사용한다. 메모 본문을 고칠 때는 바뀐 부분만이 아니라 그 메모의 전체 본문을 blocks로 다시 보낸다.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            memos: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "integer", description: "현재 보드에 있는 메모 카드 ID" },
                        blocks: {
                            type: "array",
                            minItems: 1,
                            items: memoBlockSchema,
                            description: "메모의 새 본문 전체. 내용을 바꾸지 않으면 생략",
                        },
                        color: {
                            type: "string",
                            enum: [...planMemoColors],
                            description: "새 배경색. 바꾸지 않으면 생략",
                        },
                    },
                    required: ["id"],
                },
            },
            mermaids: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "integer", description: "현재 보드에 있는 Mermaid 카드 ID" },
                        source: { type: "string", description: "새 Mermaid 문법 전체" },
                    },
                    required: ["id", "source"],
                },
            },
            tables: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "integer", description: "현재 보드에 있는 표 카드 ID" },
                        columns: { type: "array", items: { type: "string" }, description: "새 열 이름 전체" },
                        rows: {
                            type: "array",
                            items: { type: "array", items: { type: "string" } },
                            description: "새 행 데이터 전체. 각 행의 길이는 columns와 맞춘다",
                        },
                    },
                    required: ["id", "columns", "rows"],
                },
            },
        },
    },
};

export const deleteBoardCardsFunction: FunctionDeclaration = {
    name: deleteBoardCardsToolName,
    description:
        "보드에 이미 있는 카드를 지운다. 반드시 대화에 주어진 현재 보드 카드 목록의 ID만 사용한다. 사용자가 무엇을 지울지 분명히 밝혔을 때만 호출하고, 애매하면 먼저 되묻는다.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            memoIds: { type: "array", items: { type: "integer" }, description: "지울 메모 카드 ID 목록" },
            mermaidIds: { type: "array", items: { type: "integer" }, description: "지울 Mermaid 카드 ID 목록" },
            tableIds: { type: "array", items: { type: "integer" }, description: "지울 표 카드 ID 목록" },
            imageIds: { type: "array", items: { type: "integer" }, description: "지울 이미지 카드 ID 목록" },
        },
    },
};

export const assistantSystemPrompt = [
    "너는 Meldrift Free Edition의 AI 어시스턴트다. Meldrift Free Edition은 보드 위에 카드를 배치하면 그 배치가 그대로 하나의 Markdown 문서로 컴파일되는 도구다.",
    "본판 Meldrift와 달리 보드가 하나뿐이고, 로그인이 없고, 데이터가 브라우저 안의 SQFree Edition 파일에 저장된다.",
    "",
    "규칙:",
    `- 문서나 설계를 만들어 달라는 요청에는 반드시 ${createBoardCardsToolName} 함수를 호출한다. 카드 내용을 채팅 본문에 그대로 적지 않는다.`,
    "- 섹션 순서가 최종 문서의 순서다. 개요에서 세부로 이어지도록 구성한다.",
    "- 메모 본문은 blocks 배열로만 표현한다. HTML이나 Markdown 문법 문자열을 직접 넣지 않는다.",
    "- 흐름·구조·관계를 보여줄 섹션에는 mermaid attachment를, 항목 비교나 정리에는 table attachment를 붙인다. 필요 없는 섹션에는 붙이지 않는다.",
    "- 한 섹션에는 attachment를 최대 하나만 붙일 수 있다.",
    "- Mermaid 문법은 flowchart, sequenceDiagram 등 표준 문법만 쓰고 노드 라벨은 큰따옴표로 감싼다.",
    "- 표를 만들 때 각 행의 셀 개수를 columns 개수와 정확히 맞춘다.",
    "- 단순한 질문이나 잡담에는 함수를 호출하지 말고 짧게 답한다.",
    "- 사용자가 쓴 언어로 답한다.",
    "",
    "배치(layout) 선택:",
    "- column: 처음부터 끝까지 한 줄기로 읽는 문서. 회고, 설명서, 순서가 중요한 글.",
    "- grid: 서로 대등한 항목을 나열하는 문서. 비교표 모음, 체크리스트, 카드 목록.",
    "- tree: 상위 개념 아래에 하위 항목이 붙는 구조. 아키텍처 설계, 조직도, 기능 분해.",
    "- scatter: 순서나 계층이 중요하지 않고 아이디어를 흩어 놓는 경우. 브레인스토밍, 자유 메모, 착상 모으기.",
    "- 사용자가 자유롭게·흩어서·랜덤하게 배치해 달라고 하면 scatter를 고른다.",
    "- tree를 고르면 각 섹션에 parentIndex로 상위 섹션을 지정한다. 최상위 섹션은 parentIndex를 생략한다.",
    "- parentIndex는 반드시 자기 인덱스보다 작아야 한다. 개요를 먼저 쓰고 세부를 뒤에 쓰면 자연히 지켜진다.",
    "",
    `- 이미 있는 카드를 정리·재배치하거나 표·다이어그램을 다른 메모에 붙이라는 요청에는 ${rearrangeBoardCardsToolName}를 호출한다. 이때 대화에 주어진 현재 보드 카드 목록의 ID만 쓴다.`,
    "- 좌표(x, y)는 절대 지정하지 않는다. 위치는 Meldrift가 계산한다. 너는 순서와 붙임 관계만 정한다.",
    "- 최종 문서 순서는 메모의 생성 순서로 이미 정해져 있다. 재배치로는 문서 순서를 바꿀 수 없다.",
    "",
    "카드 고치기와 지우기:",
    `- 이미 있는 카드의 내용을 바꾸라는 요청에는 ${editBoardCardsToolName}를 호출한다.`,
    "- 메모 본문을 고칠 때는 바뀐 문장만 보내지 않는다. 그 메모의 전체 본문을 blocks로 다시 만들어 보낸다. 보낸 내용이 기존 본문을 통째로 대체한다.",
    "- 표나 Mermaid도 마찬가지로 전체를 다시 보낸다.",
    `- 카드를 지우라는 요청에는 ${deleteBoardCardsToolName}를 호출한다.`,
    "- 무엇을 지울지 분명하지 않으면 지우지 말고 먼저 되묻는다. '정리해줘', '깔끔하게 해줘' 같은 말은 삭제 지시가 아니다.",
    "- 고치기와 지우기 모두 현재 보드 카드 목록에 있는 ID만 쓴다. 목록에 없는 ID는 절대 지어내지 않는다.",
    "",
    "그림(이미지):",
    "- Meldrift Free Edition에서는 AI로 그림을 만들 수 없다. 이미지 카드는 사용자가 로컬 이미지 파일을 직접 골라 만드는 것뿐이다.",
    "- 그림을 만들어 달라는 요청에는 만들 수 없다고 답하고, 다이어그램이면 mermaid를, 그림이면 카메라 버튼에서 로컬 파일을 고르는 방법을 알려 준다.",
    "- 이미 보드에 있는 이미지 카드는 지우기 대상으로만 다룬다.",
    "",
    "사용법 안내:",
    "- Meldrift Free Edition을 어떻게 쓰는지 묻는 질문에는 함수를 호출하지 말고 아래 사용법을 근거로 말로 설명한다.",
    "- 예: 메모를 어떻게 쓰는지, Mermaid 문법을 어떻게 적는지, 카드가 왜 문서에 안 나오는지, 저장 파일을 어떻게 백업하는지.",
    "- 아래 사용법에 없는 기능은 없다고 답한다. 있을 법한 기능을 지어내지 않는다.",
    "- 설명은 짧게 하고, 필요하면 단계로 나눠 적는다.",
    "",
    meldriftGuide,
].join("\n");

export type AssistantMessage = {
    role: "user" | "assistant";
    content: string;
};

export type BoardSnapshot = {
    memos: { id: number; summary: string }[];
    mermaids: { id: number; summary: string }[];
    tables: { id: number; summary: string }[];
    images: { id: number; summary: string }[];
    /** 보드에 더 배치할 수 있는 섹션 수. 모델이 분량을 맞추는 데 쓴다. */
    capacity: number;
};

export type AssistantResult = {
    reply: string;
    plan: BoardPlan | null;
    arrangement: BoardArrangement | null;
    edit: BoardEdit | null;
    deletion: BoardDeletion | null;
};

const emptyResult = {
    plan: null,
    arrangement: null,
    edit: null,
    deletion: null,
};

// Gemini는 어시스턴트 역할을 "model"로 부른다.
const toGeminiContents = (messages: AssistantMessage[]): Content[] =>
    messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
    }));

// 재배치를 하려면 모델이 현재 보드에 무엇이 있는지 알아야 한다.
const describeSnapshot = (snapshot: BoardSnapshot) => {
    const describe = (label: string, cards: { id: number; summary: string }[]) =>
        cards.length === 0
            ? `${label}: 없음`
            : `${label}:\n${cards.map((card) => `  - id ${card.id}: ${card.summary}`).join("\n")}`;

    return [
        "현재 보드 상태:",
        describe("메모 카드", snapshot.memos),
        describe("Mermaid 카드", snapshot.mermaids),
        describe("표 카드", snapshot.tables),
        describe("이미지 카드", snapshot.images),
        `이 보드에 새로 배치할 수 있는 섹션은 최대 ${snapshot.capacity}개다. 이보다 많이 만들지 않는다.`,
    ].join("\n");
};

export async function runBoardAssistant(
    apiKey: string,
    messages: AssistantMessage[],
    snapshot: BoardSnapshot
): Promise<AssistantResult> {
    const ai = new GoogleGenAI({ apiKey });
    const request = {
        contents: toGeminiContents(messages),
        config: {
            systemInstruction: [assistantSystemPrompt, "", describeSnapshot(snapshot)].join("\n"),
            tools: [
                {
                    functionDeclarations: [
                        createBoardCardsFunction,
                        rearrangeBoardCardsFunction,
                        editBoardCardsFunction,
                        deleteBoardCardsFunction,
                    ],
                },
            ],
        },
    };

    let response;
    let lastError: unknown;

    for (const model of assistantModels) {
        try {
            response = await ai.models.generateContent({ model, ...request });
            break;
        } catch (error) {
            lastError = error;

            if (!isRetryableModelError(error)) {
                throw error;
            }
            console.warn(`Gemini model ${model} unavailable, trying the next one.`);
        }
    }

    if (!response) {
        console.error("All Gemini models failed:", lastError);
        throw new AssistantUnavailableError(
            isQuotaError(lastError)
                ? "The daily AI quota for this server has run out. Try again later or raise the quota on the Google account."
                : "All AI models are busy right now. Please try again in a moment."
        );
    }

    const replyText = response.text?.trim();
    const calls = response.functionCalls ?? [];

    // 파괴적인 순서로 먼저 본다. 삭제 > 고치기 > 재배치 > 생성.
    const deleteCall = calls.find((call) => call.name === deleteBoardCardsToolName);

    if (deleteCall?.args) {
        const parsed = boardDeletionSchema.safeParse(deleteCall.args);
        const total = parsed.success
            ? (parsed.data.memoIds?.length ?? 0) +
              (parsed.data.mermaidIds?.length ?? 0) +
              (parsed.data.tableIds?.length ?? 0) +
              (parsed.data.imageIds?.length ?? 0)
            : 0;

        if (!parsed.success || total === 0) {
            return { ...emptyResult, reply: "I could not tell which cards to delete. Please name them." };
        }

        return {
            ...emptyResult,
            reply: replyText || `Removed ${total} card(s). You can undo this before saving.`,
            deletion: parsed.data,
        };
    }

    const editCall = calls.find((call) => call.name === editBoardCardsToolName);

    if (editCall?.args) {
        const parsed = boardEditSchema.safeParse(editCall.args);
        const total = parsed.success
            ? (parsed.data.memos?.length ?? 0) +
              (parsed.data.mermaids?.length ?? 0) +
              (parsed.data.tables?.length ?? 0)
            : 0;

        if (!parsed.success || total === 0) {
            return { ...emptyResult, reply: "I could not understand the edit. Please try again." };
        }

        return {
            ...emptyResult,
            reply: replyText || `Updated ${total} card(s). Review them and save.`,
            edit: parsed.data,
        };
    }

    const rearrangeCall = calls.find((call) => call.name === rearrangeBoardCardsToolName);

    if (rearrangeCall?.args) {
        // 모델이 스키마를 벗어난 인자를 보낼 수 있으므로 반드시 다시 검증한다.
        const parsed = boardArrangementSchema.safeParse(rearrangeCall.args);

        if (!parsed.success) {
            return { ...emptyResult, reply: "I could not understand the layout change. Please try again." };
        }

        return {
            ...emptyResult,
            reply: replyText || "Rearranged the cards. Review them and save.",
            arrangement: parsed.data,
        };
    }

    const createCall = calls.find((call) => call.name === createBoardCardsToolName);

    if (!createCall?.args) {
        return { ...emptyResult, reply: replyText || "I could not understand that request. Please rephrase it." };
    }

    const parsedArguments = boardPlanSchema.safeParse(createCall.args);

    if (!parsedArguments.success) {
        return { ...emptyResult, reply: "I could not build the cards. Please describe what you need in more detail." };
    }

    const sectionCount = parsedArguments.data.sections.length;

    return {
        ...emptyResult,
        reply: replyText || `Created ${sectionCount} card(s). Review them and save.`,
        plan: parsedArguments.data,
    };
}
