# BoardZoomControl 상세설계

소스: `components/BoardZoomControl.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `boardZoom` | `number` | 표시값 `Math.round(boardZoom * 100)}%` (39줄) |
| `setBoardZoom` | `Dispatch<SetStateAction<number>>` | `changeZoom` 내부에서 함수형 업데이트로 호출 (17줄) |

## State

없음 — 줌 값 자체는 호출자(부모)의 state이고, 이 컴포넌트는 setter만 받아 조작한다.

## 핸들러: `changeZoom(amount: number)` (16~18줄)

```
setBoardZoom(prev => Math.min(2, Math.max(0.25, Number((prev + amount).toFixed(2)))))
```

- 하한 0.25, 상한 2로 clamp.
- `toFixed(2)` → `Number(...)` 변환으로 부동소수 누적 오차(예: 0.1 + 0.2 문제)를 2자리에서 절삭.
- "-" 버튼(33줄): `changeZoom(-0.05)`
- "+" 버튼(44줄): `changeZoom(0.05)`

## 렌더 구조 (20~51줄)

| 요소 | 스타일/속성 | 비고 |
| --- | --- | --- |
| 루트 `div` (21줄) | `fixed bottom-7 right-5`, `z-50000`, class `board-toolbar` | 인라인 style로 `WebkitTouchCallout/WebkitUserSelect/userSelect: none` 지정 |
| "-" `PressableButton` (30줄) | `aria-label="Zoom out"`, `h-8 w-8` | 아이콘 `Minus` |
| 퍼센트 `<span>` (38줄) | `text-xs font-semibold` | `{Math.round(boardZoom * 100)}%` |
| "+" `PressableButton` (41줄) | `aria-label="Zoom in"`, `h-8 w-8` | 아이콘 `Plus` |

## 알려진 특이사항

- `board-toolbar` 클래스는 `hooks/useBoardScroll.ts:56`의 패닝 제외 selector 목록에도 포함돼 있어, 이 컨트롤 위에서는 보드 드래그 패닝이 시작되지 않는다(다른 파일 검증 필요 시 `board-client.md`/`useBoardScroll` 문서 참조).
- 줌 인/아웃 단위(0.05)가 컴포넌트 내부 상수로 하드코딩돼 있어, 다른 값으로 바꾸려면 이 파일을 직접 수정해야 한다(prop화되어 있지 않음).
