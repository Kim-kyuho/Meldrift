# AboutModal 상세설계

소스: `components/AboutModal.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `onClose` | `() => void` | 배경, 닫기 버튼, Escape 입력으로 모달을 닫는다 |

## 렌더 구조

- `createPortal`을 사용해 `document.body`에 렌더링한다.
- 배경 클릭은 모달을 닫고, 본문 클릭은 이벤트 전파를 중단한다.
- Email, GitHub, Blog 링크를 표시한다.
- 외부 링크는 새 탭으로 열며 `noreferrer noopener`를 적용한다.
