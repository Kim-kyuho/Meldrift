# 보드 상태와 검증 상세설계

소스: `lib/board-state.ts`

## 목적

Free Edition이 다루는 보드 전체를 하나의 값(`BoardSnapshot`)으로 정의하고, 그 값이 SQLite와 화면 사이를 오갈 때마다 zod로 검증한다. 세이브 파일은 사용자가 손댈 수 있는 파일이므로 신뢰하지 않는다.

## 고정값

| 이름 | 값 | 의미 |
| --- | --- | --- |
| `defaultBoardId` | `1` | Free Edition은 보드가 하나뿐이다 |
| `schemaVersion` | `3` | 브라우저 DB의 `PRAGMA user_version` |
| `defaultBoard` | `{ 1, "Meldrift Free Edition", 4000, 3000 }` | 초기화 시 넣는 보드 |

## 타입

| 타입 | 정의 |
| --- | --- |
| `BoardInfo` | `boardId`, `title`, `width`, `height` |
| `BoardMemo` | `@meldrift/core`의 `MemoCardData` 그대로 |
| `BoardMermaid` | `@meldrift/core`의 `MermaidCardData` 그대로 |
| `BoardTable` | `@meldrift/core`의 `TableCardData` 그대로 |
| `BoardImage` | Free 고유 — 아래 참조 |
| `BoardSnapshot` | `board` + `memos`/`images`/`mermaids`/`tables`/`strokes` |

메모·머메이드·표는 Plus와 형태가 같아 코어 타입을 그대로 쓴다. 이미지만 다르다.

```text
BoardImage = imageId, boardId, url, data, mimeType, label, x, y, z, width, height
```

`data`는 압축된 이미지 바이트(`Uint8Array`)이고 `mimeType`이 그 형식이다. Plus의 `publicId`/`secureUrl` 자리를 대신한다.

## 검증 규칙

좌표는 정수, 크기는 양의 정수다. `boardId`는 `z.literal(1)`이라 다른 보드 값이 섞여 들어오면 거부된다.

| 대상 | 규칙 |
| --- | --- |
| `board.title` | 공백을 제외하고 1자 이상 |
| `memo.sortOrder` | 양의 정수 (0 이하 불가) |
| `memo.color` | 1자 이상 |
| `mermaid.source` | 공백 제외 1자 이상 |
| `table.source` | `@meldrift/core`의 `tableSourceSchema` |
| `strokes` | `@meldrift/core`의 `boardStrokesSchema` |

## 이미지의 두 가지 모드

`imageSchema`는 `superRefine`으로 **로컬 바이트**와 **구버전 URL** 둘 중 하나만 성립하도록 강제한다.

`data`가 있으면 로컬 바이트 모드다.

- `url`이 빈 문자열이어야 한다
- 바이트가 1 이상 `maxStoredImageBytes`(5 MiB) 이하여야 한다
- `mimeType`이 `supportedImageMimeTypes` 안에 있어야 한다

`data`가 없으면 구버전 URL 모드다.

- `url`이 `http:` 또는 `https:`로 파싱되어야 한다
- `mimeType`이 `null`이어야 한다

두 조건을 섞은 값(예: 바이트와 URL을 동시에 가진 행)은 어느 쪽으로도 통과하지 못한다.

## 함수

| 함수 | 동작 |
| --- | --- |
| `createEmptyBoardSnapshot()` | 기본 보드 하나에 카드·획이 전부 빈 스냅샷 |
| `parseBoardSnapshot(value)` | 통과하면 검증된 스냅샷, 실패하면 `The SQLite file contains invalid Meldrift Free Edition data.` |
| `nextPositiveId(ids)` | 양수 id 중 최댓값 + 1. 비어 있으면 1 |

`parseBoardSnapshot`은 실패 이유를 문구에 담지 않는다. 호출부는 워커의 읽기·쓰기·불러오기 세 곳이다.
