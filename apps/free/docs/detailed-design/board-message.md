# BoardMessage 상세설계

소스: `components/BoardMessage.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `message` | `string` | 각 분기에서 `{message && (...)}`로 빈 문자열이면 아무것도 렌더하지 않음 (13, 27, 41줄) |
| `type` | `"board" \| "memo" \| "error"` | 상단 보드 메시지, 메모 메시지 또는 인라인 오류를 선택 |
| `onDismiss` | `() => void` (선택) | 메시지가 표시된 지 3.5초 후 호출 |

## State

렌더링 State는 없다. 최신 `onDismiss`를 유지하는 ref와 메시지별 타이머 effect를 사용한다.

## 렌더 분기 (10~48줄)

| `type` | 조건부 렌더 여부 | 컨테이너 | 스타일 | 비고 |
| --- | --- | --- | --- | --- |
| `"board"` | `message`가 truthy일 때만 | `div` | `fixed left-1/2 top-20 ... rounded-xl bg-white ... text-rose-600 shadow-md`, `zIndex: 60` | 저장·전송·이미지·AI 등 보드 전반의 상태와 오류 |
| `"memo"` | `message`가 truthy일 때만 | `div` | `board`와 같은 상단 고정 스타일 | 메모 검색과 이동 메시지 |
| `"error"` | `message`가 truthy일 때만 | `p` | `text-xs leading-5 text-rose-600` | 상단 고정이 아니라 부모 레이아웃 안 인라인 문단 |

## 알려진 특이사항

- `"board"`와 `"memo"`는 의미만 다르고 같은 상단 고정 마크업을 공유한다.
- 메시지가 비어 있지 않으면 3.5초 타이머를 시작하고, 메시지가 바뀌거나 컴포넌트가 해제되면 이전 타이머를 정리한다.
