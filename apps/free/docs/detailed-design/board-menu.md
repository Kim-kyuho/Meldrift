# BoardMenu 상세설계

소스: `components/BoardMenu.tsx`

좌측 상단에는 태그라인이나 Free Edition 배지 없이 마스코트 아이콘과 `meldrift` 워드마크를 나란히 표시하며, 전체 로고는 홈으로 이동하는 링크다.

우측 상단 메뉴는 제품 등급을 나타내는 `Free Edition`과 다음 동작을 순서대로 표시한다.

1. Export
2. Import
3. Compile to Markdown
4. Reset
5. About

Export는 카드 또는 드로잉 편집 중에 비활성화되며 이유를 메뉴 안에 표시한다. Import와 Export 전송 중에는 중복 요청을 막는다. Compile to Markdown은 현재 snapshot의 미리보기 모달을 열며, 모달의 다운로드 버튼은 Markdown과 선택된 로컬 PNG 이미지를 하나의 ZIP으로 저장한다. Reset은 Shredder 아이콘과 함께 Compile to Markdown 바로 아래에 있고 확인 모달을 거친다. 이 동작은 현재 origin의 Meldrift Free Edition 전용 IndexedDB 데이터베이스만 삭제하며 다른 IndexedDB, 캐시, localStorage, 쿠키는 건드리지 않는다. About은 메뉴 최하단에서 연락처 모달을 연다. 로그인과 보드 관리 메뉴는 없다.
