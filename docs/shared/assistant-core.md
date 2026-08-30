# `@meldrift/ai` 상세설계

소스: `packages/ai/src/assistant.ts`

## 위치

어시스턴트 본체다. 도구 정의, Gemini 호출, 모델 폴백, 시스템 프롬프트 뼈대를 가진다. Edition별로 갈리는 것은 **문구뿐**이라, 각 앱의 `lib/ai/assistant.ts`가 39줄짜리 얇은 파일로 남아 이 본체에 제품 문구를 주입한다.

계획 스키마와 좌표 배치는 `packages/core/src/board-plan.ts`가 가진다. 이 패키지는 모델을 부르고 결과를 그 스키마로 검증하는 데까지만 관여한다.

## `AssistantProduct`

앱이 주입하는 값이다. 프롬프트에서 Edition마다 달라지는 네 자리를 채운다.

| 필드 | 역할 |
| --- | --- |
| `intro` | 이 제품이 무엇이고 무엇이 없는지 |
| `imageRules` | 그림 요청을 어떻게 돌려보낼지 (이미지를 넣는 방법이 앱마다 다르다) |
| `usageRules` | 사용법 질문에 어떻게 답할지 |
| `guide` | 제품 사용법 본문 |

`createAssistantSystemPrompt(product)`가 이 넷을 뼈대에 끼워 시스템 프롬프트를 만든다.

## 모델 폴백

```text
gemini-3.6-flash → gemini-3.5-flash → gemini-3.7-flash → gemini-flash-latest
```

선호 순서대로 시도해 첫 성공을 쓴다. **최신순이 아니다.** 최신 모델일수록 무료 티어 할당량이 빡빡해 429가 먼저 나므로, 할당량이 여유로운 쪽을 앞에 둔다. 3.7은 빠르지만 금방 막혀 뒤로 미룬다.

`GEMINI_MODEL` 환경 변수가 있으면 그 모델을 맨 앞에 두고 나머지를 뒤에 잇는다.

`gemini-2.5-flash`는 `models.list`에는 보이지만 `generateContent`가 404라 목록에 넣지 않는다.

### 실패 구분

| 판정 | 동작 |
| --- | --- |
| `isRetryableModelError` | 다음 모델로 넘어간다. 400(잘못된 요청)은 재시도해도 같으므로 제외 |
| `isQuotaError` | 429. 사용자가 할 수 있는 일이 다르다 — 초기화를 기다리거나 결제를 붙여야 한다 |
| 그 밖의 일시 장애 | 503. 잠시 뒤 재시도로 풀린다 |

모든 모델이 실패하면 `AssistantUnavailableError`를 던진다. 호출자는 이것을 503으로 응답한다.

## 도구 (function calling)

카드 생성은 자유 텍스트 파싱이 아니라 **function calling으로만** 받는다. 모델이 문장 안에 JSON을 섞어 보내는 것을 신뢰하지 않는다.

| 도구 이름 | 하는 일 |
| --- | --- |
| `create_board_cards` | 새 카드 계획 |
| `rearrange_board_cards` | 기존 카드 재배치 |
| `edit_board_cards` | 기존 카드 내용 수정 |
| `delete_board_cards` | 카드 삭제 |

Gemini는 `parametersJsonSchema`로 일반 JSON Schema를 그대로 받는다. 그래서 도구 파라미터는 zod가 아니라 JSON Schema로 적혀 있고, 응답은 `board-plan.ts`의 zod 스키마로 다시 검증한다.

이미지 생성 도구는 없다. 저장 용량과 API 비용을 따로 제어해야 해서 지원하지 않고, 이미지 카드는 지우기 대상으로만 다룬다.

## 입출력

```text
runBoardAssistant(apiKey, messages, snapshot, product) → AssistantResult
```

| 타입 | 내용 |
| --- | --- |
| `AssistantMessage` | `role: "user" \| "assistant"`, `content` |
| `BoardSnapshot` | 카드 네 종류의 `{ id, summary }` 목록과 `capacity` |
| `AssistantResult` | `reply`와 `plan`·`arrangement`·`edit`·`deletion` (없으면 `null`) |

`toGeminiContents`가 역할 이름을 바꾼다. Gemini는 어시스턴트 역할을 `"model"`로 부른다.

`describeSnapshot`은 현재 보드에 무엇이 있는지 문장으로 만들어 프롬프트에 넣는다. 재배치·수정·삭제를 하려면 모델이 대상 id를 알아야 하기 때문이다.

`capacity`는 보드에 더 놓을 수 있는 섹션 수다. 모델이 분량을 스스로 맞추는 데 쓴다.
