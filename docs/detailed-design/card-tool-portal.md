# CardToolPortal 상세설계

소스: `components/CardToolPortal.tsx`

이 파일은 두 개의 named export로 구성된다: `CardToolPortal`, `CardToolButton`.

## CardToolPortal

### Props

| Prop | 타입/기본값 | 사용처 |
| --- | --- | --- |
| `children` | `ReactNode` | portal 내부에 그대로 렌더 (23~25줄) |
| `animate` | `boolean`, 기본 `true` | wrapper `className`에 `"toolbar-reveal"` 추가 여부 (23줄) |

### State

없음.

### 로직 (7~28줄)

1. `document.getElementById("card-tool-portal")`을 조회 (`typeof document === "undefined"`이면 SSR로 간주해 `null` 고정, 14~16줄)
2. `portalTarget`이 없으면 컴포넌트는 아무것도 렌더하지 않고 `null` 반환 (18~20줄)
3. 있으면 `createPortal(<div className="{animate ? toolbar-reveal : ''} flex flex-col items-end gap-1">{children}</div>, portalTarget)` 실행

## CardToolButton

### Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `label` | `string` | `aria-label`과 `title`에 동시 사용 (46~47줄) — 필수, 접근성과 툴팁을 이 하나의 문자열로 겸함 |
| `children` | `ReactNode` | 버튼 내부(아이콘) (50줄) |
| `className` | `string`, 기본 `""` | 공통 클래스 뒤에 이어붙임 (48줄) |
| 나머지 `ButtonHTMLAttributes` | - | `{...props}`로 `PressableButton`에 그대로 전달 (44줄) |

### 렌더 구조

| 요소 | 비고 |
| --- | --- |
| 바깥 `div.relative` (42줄) | 배지 등 절대배치 확장 여지를 위한 래퍼로 추정(현재 자식 없음) |
| `PressableButton` (43줄) | `variant="menu"` 고정, `h-10 w-10` 정사각 아이콘 버튼, `[&_svg]:h-5 [&_svg]:w-5`로 내부 SVG를 20x20 강제 |

## 알려진 특이사항

- `CardToolButton`은 `label` prop 하나로 `aria-label`과 `title`을 동시에 채우므로, 스크린리더용 문구와 마우스 툴팁 문구를 분리할 수 없다.
- `CardToolPortal`은 대상 DOM이 없으면 조용히 `null`을 반환한다 — 포탈 타깃 id(`card-tool-portal`)가 오타나거나 아직 마운트되지 않은 경우 에러 없이 버튼이 안 보이는 형태로만 나타난다.
