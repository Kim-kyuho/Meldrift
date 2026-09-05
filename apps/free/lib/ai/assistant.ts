// 어시스턴트 본체(도구 정의 · Gemini 호출 · 프롬프트 뼈대)와 에디션 문구는 @meldrift/ai가 가진다.
// 여기에는 이 앱이 가진 사용법 본문을 물려주는 배선만 둔다.

import { createAssistantRunner, createMeldriftProduct } from "@meldrift/ai/product";
import { meldriftGuide } from "@/lib/ai/meldrift-guide";

export const meldriftProduct = createMeldriftProduct("free", meldriftGuide);

export const runAssistant = createAssistantRunner(meldriftProduct);
