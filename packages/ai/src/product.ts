// 에디션마다 달라지는 프롬프트 문구를 한곳에 모은다.
// 두 앱이 각자 AssistantProduct를 손으로 쓰면 한쪽만 고쳐지고 조용히 어긋난다.
// 여기서 나란히 두면 무엇이 다른지가 diff가 아니라 파일 하나로 보인다.
//
// 사용법 본문(guide)만은 앱이 넣어 준다. 문서 자체가 에디션마다 다른 글이라
// 여기에 두면 이 파일이 사용법 문서 두 벌을 안게 된다.

import {
    runBoardAssistant,
    type AssistantMessage,
    type AssistantProduct,
    type BoardSnapshot,
} from "./assistant";

export type MeldriftEdition = "free" | "plus";

type EditionCopy = Omit<AssistantProduct, "guide">;

// 두 에디션의 차이는 셋뿐이다. 이름, 이미지를 넣는 경로, 들 수 있는 사용법 예시.
const editionCopy: Record<MeldriftEdition, EditionCopy> = {
    // 무료 등급 API로는 그림을 만들 수 없으므로 이미지 카드는 사용자가 고른
    // 로컬 파일만 받고, 어시스턴트는 지우기 대상으로만 다룬다.
    free: {
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
    },
    // 본판도 AI 이미지 생성은 하지 않는다. 다만 이미지를 올리는 경로가 달라
    // 안내 문구가 파일 선택이 아니라 업로드다.
    plus: {
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
    },
};

/** 에디션 문구와 앱이 가진 사용법 본문을 합쳐 프롬프트 조각을 만든다. */
export const createMeldriftProduct = (edition: MeldriftEdition, guide: string): AssistantProduct => ({
    ...editionCopy[edition],
    guide,
});

/** 제품을 한 번 묶어 두고 호출부는 키와 대화만 넘기게 한다. */
export const createAssistantRunner = (product: AssistantProduct) =>
    (apiKey: string, messages: AssistantMessage[], snapshot: BoardSnapshot) =>
        runBoardAssistant(apiKey, messages, snapshot, product);
