# PressableButton 상세설계

소스: `components/PressableButton.tsx`

## Props

| Prop | 타입/기본값 | 사용처 |
| --- | --- | --- |
| `variant` | `"default" \| "menu"`, 기본 `"default"` | `baseClassName`/`pressedClassName` 선택 (22~31줄) |
| `className` | `string`, 기본 `""` | 최종 `className` 뒤에 결합 (37줄) — 호출자가 스타일을 덮어씀 가능 |
| `onTouchStart` / `onTouchEnd` / `onTouchCancel` | 표준 핸들러, 옵셔널 | 내부 래퍼가 먼저 `pressed` 상태를 갱신한 뒤 원본 핸들러를 호출 (38~49줄) |
| `children` | `ReactNode` | 버튼 내용 (51줄) |
| 나머지 `ButtonHTMLAttributes` | - | `{...props}`로 `<button>`에 그대로 전달 (36줄) |

## State

| State | 타입/초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `pressed` | `boolean`, `false` (19줄) | `onTouchStart`에서 `true` (39줄), `onTouchEnd`/`onTouchCancel`에서 `false` (43, 47줄) | `className` 조합 시 `pressed`가 true면 `pressedClassName` 추가 (37줄) |

## 클래스 조합 규칙 (22~31줄)

| variant | baseClassName | pressedClassName |
| --- | --- | --- |
| `"default"` | `ui-button` | `scale-[0.96] bg-white/80 shadow-lg` |
| `"menu"` | `ui-button-menu` | `scale-[0.98] bg-white/90 pl-4 shadow-md` |

최종 클래스: `` `${base} ${pressed ? pressedClass : ""} ${className}`.trim() `` (37줄)

## 알려진 특이사항

- `pressed` 갱신은 터치 이벤트에서만 일어난다 — 마우스 클릭(`onMouseDown`/`onMouseUp`)에는 반응하지 않으므로 데스크톱에서는 이 눌림 효과가 나타나지 않는다.
- `onTouchStart` 등을 옵셔널 체이닝(`?.`)으로 호출하므로 호출자가 해당 핸들러를 안 넘겨도 안전하다.
