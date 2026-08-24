# Meldrift Snippets

Meldrift에서 실제로 사용한 코드 패턴을 개인 개발용 스니펫으로 압축한 문서.

목적은 코드를 그대로 복사하는 것이 아니라, 다음 프로젝트에서 같은 구조를 빠르게 다시 만들 수 있도록 인터페이스 형태로 정리하는 것이다.

## 목록

- [상태와 Ref 패턴](./state-and-ref.md)
- [포인터 이벤트와 타이머](./pointer-and-timer-events.md)
- [보드 줌과 패닝](./board-zoom-and-pan.md)
- [Rnd 카드 조작](./rnd-card-controls.md)
- [컨텍스트 메뉴](./context-menu.md)
- [UI 피드백](./ui-feedback.md)

## 기준

- `useState`: 화면에 반영되어야 하는 값
- `useRef`: 렌더링과 무관한 임시 값, DOM 참조, 타이머 ID
- `useEffect`: document/window 전역 이벤트 연결
- `useCallback`: 외부 값에 의존하는 저장/이동/포커스 함수
