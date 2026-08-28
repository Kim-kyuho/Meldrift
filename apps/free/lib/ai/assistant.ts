// 어시스턴트 본체(도구 정의 · Gemini 호출 · 프롬프트 뼈대)는 @meldrift/ai가 가진다.
// 여기에는 Free Edition이라서 달라지는 문구만 둔다.
//
// Free Edition의 이미지 카드는 사용자가 고른 로컬 파일만 받는다. AI 이미지 생성은 무료 등급
// API로는 불가능하므로 지원하지 않고, 이미지 카드는 지우기 대상으로만 다룬다.

import { runBoardAssistant, type AssistantMessage, type AssistantProduct, type BoardSnapshot } from "@meldrift/ai/assistant";
import { meldriftGuide } from "@/lib/ai/meldrift-guide";

export const freeEditionProduct: AssistantProduct = {
    intro: [
        "너는 Meldrift Free Edition의 AI 어시스턴트다. Meldrift Free Edition은 보드 위에 카드를 배치하면 그 배치가 그대로 하나의 Markdown 문서로 컴파일되는 도구다.",
        "본판 Meldrift와 달리 보드가 하나뿐이고, 로그인이 없고, 데이터가 브라우저 안의 SQLite 파일에 저장된다.",
    ],
    imageRules: [
        "- Meldrift Free Edition에서는 AI로 그림을 만들 수 없다. 이미지 카드는 사용자가 로컬 이미지 파일을 직접 골라 만드는 것뿐이다.",
        "- 그림을 만들어 달라는 요청에는 만들 수 없다고 답하고, 다이어그램이면 mermaid를, 그림이면 카메라 버튼에서 로컬 파일을 고르는 방법을 알려 준다.",
    ],
    usageRules: [
        "- Meldrift Free Edition을 어떻게 쓰는지 묻는 질문에는 함수를 호출하지 말고 아래 사용법을 근거로 말로 설명한다.",
        "- 예: 메모를 어떻게 쓰는지, Mermaid 문법을 어떻게 적는지, 카드가 왜 문서에 안 나오는지, 저장 파일을 어떻게 백업하는지.",
    ],
    guide: meldriftGuide,
};

export const runAssistant = (apiKey: string, messages: AssistantMessage[], snapshot: BoardSnapshot) =>
    runBoardAssistant(apiKey, messages, snapshot, freeEditionProduct);

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
