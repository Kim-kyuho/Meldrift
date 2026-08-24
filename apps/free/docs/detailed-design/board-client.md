# BoardClient 상세설계

소스: `components/BoardClient.tsx`, `lib/browser-db/*`

`BoardClient`는 브라우저 SQLite에서 단일 보드 snapshot을 읽고 카드별 훅에 전달해 UI를 조립한다. 서버 props와 API 요청은 사용하지 않는다.

## 시작과 자동 저장

1. 마운트 후 `loadBoardState()`가 Worker를 시작한다.
2. Worker가 SQLite WASM을 초기화하고 IndexedDB의 SQLite 파일을 deserialize한다.
3. 저장된 전체 snapshot을 React 상태에 적용한 뒤 보드를 렌더링한다.
4. 상태가 바뀌고 편집/드로잉/AI 제안 중이 아니면 150ms 후 `replaceBoardState(snapshot)`으로 트랜잭션 저장한다.

초기화 실패 시 빈 보드로 조용히 진행하지 않고 브라우저 저장소 요구사항을 포함한 오류 화면을 표시한다.

AI 어시스턴트가 올린 임시 카드는 음수 ID를 쓰고 `parseBoardSnapshot`은 양수 ID만 받는다. 그래서 저장하지 않은 제안이 남아 있는 동안에는 자동 저장을 멈춘다. 사용자가 Save를 눌러 임시 ID가 양수로 바뀌면 다시 돌면서 파일에 반영된다. 자세한 내용은 `ai-assistant.md`를 본다.

## Export 잠금

다음 중 하나라도 참이면 `BoardMenu.exportDisabled`가 참이다.

```text
editingMemoId !== null
editingImageId !== null
editingMermaidId !== null
editingTableId !== null
drawingMode === true
hasPendingAiCards === true
```

Export는 먼저 현재 snapshot 저장을 기다린 후 SQLite 파일을 내보낸다. 잠금은 카드 내부 편집 상태가 collection 상태에 아직 반영되지 않은 시점의 불완전한 파일 생성을 막는다.

## Import

숨겨진 SQLite file input은 `useBoardTransfer`가 소유한다. Worker가 임시 DB에서 무결성, 버전, 필수 테이블, snapshot 내용을 검증하고 현재 DB를 교체한다. 검증 중 오류가 나면 현재 DB는 변경하지 않는다.

## Reset

`useBoardTransfer`는 Reset 확인 상태와 진행 상태를 소유한다. 확인 후 Worker의 작업 큐에서 Meldrift Free Edition 전용 IndexedDB 데이터베이스를 삭제하고 메모리 SQLite를 닫은 다음 페이지를 새로고침한다. 진행 중에는 자동 저장과 다른 파일 전송을 중지한다. 다른 origin 저장소나 쿠키를 삭제하는 브라우저 전역 API는 호출하지 않는다.

## 메모 네비게이터

`BoardClient`는 `boardNavigatorOpen` 상태를 소유한다. 우측 툴바의 Compass 버튼으로 하단 중앙 `BoardNavigator`를 열며, 검색 패널과는 동시에 표시하지 않는다. 현재 메모 연번과 전체 메모 수는 `useBoardMemoFocus`에서 파생한다.
