// 어시스턴트 본체(도구 정의 · Gemini 호출 · 프롬프트 뼈대)는 @meldrift/ai가 가진다.
// 여기에는 Meldrift 본판이라서 달라지는 문구만 둔다.
//
// 무료 등급 API로는 그림을 만들 수 없으므로 이미지 카드는 사용자가 올린 파일만 받고,
// 어시스턴트는 지우기 대상으로만 다룬다.

import { runBoardAssistant, type AssistantMessage, type AssistantProduct, type BoardSnapshot } from "@meldrift/ai/assistant";
import { meldriftGuide } from "@/lib/ai/meldrift-guide";

export const meldriftProduct: AssistantProduct = {
    intro: [
        "너는 Meldrift의 AI 어시스턴트다. Meldrift는 보드 위에 카드를 배치하면 그 배치가 그대로 하나의 Markdown 문서로 컴파일되는 도구다.",
    ],
    imageRules: [
        "- AI로 그림을 만들 수는 없다. 이미지 카드는 사용자가 이미지 파일을 직접 올려 만드는 것뿐이다.",
        "- 그림을 만들어 달라는 요청에는 만들 수 없다고 답하고, 다이어그램이면 mermaid를, 그림이면 이미지 파일을 올리는 방법을 알려 준다.",
    ],
    usageRules: [
        "- Meldrift를 어떻게 쓰는지 묻는 질문에는 함수를 호출하지 말고 아래 사용법을 근거로 말로 설명한다.",
        "- 예: 메모를 어떻게 쓰는지, Mermaid 문법을 어떻게 적는지, 카드가 왜 문서에 안 나오는지, 드로잉을 어떻게 저장하는지.",
    ],
    guide: meldriftGuide,
};

export const runAssistant = (apiKey: string, messages: AssistantMessage[], snapshot: BoardSnapshot) =>
    runBoardAssistant(apiKey, messages, snapshot, meldriftProduct);

export {
    assistantModels,
    AssistantUnavailableError,
    createBoardCardsToolName,
    rearrangeBoardCardsToolName,
    editBoardCardsToolName,
    deleteBoardCardsToolName,
    type AssistantMessage,
    type AssistantResult,
    type BoardSnapshot,
} from "@meldrift/ai/assistant";
