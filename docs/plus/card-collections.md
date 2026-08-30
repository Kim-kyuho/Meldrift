# 카드 컬렉션 훅 상세설계

소스: `hooks/useBoardMemos.ts`, `hooks/useBoardImages.ts`, `hooks/useBoardMermaids.ts`, `hooks/useBoardTables.ts`, `hooks/useCardLayer.ts`

`BoardClient`가 서버에서 받은 초기 카드를 이 훅들에 넘긴다. 훅은 컬렉션과 편집 중인 카드 id를 들고, 카드 컴포넌트가 부르는 핸들러에서 Route Handler를 호출한다.

Free Edition의 같은 이름 훅들은 네트워크 없이 로컬 상태만 바꾼다. 차이는 [Free 카드 컬렉션](../free/card-collections.md)에 정리했다.

## 공통 입력

| 값 | 역할 |
| --- | --- |
| `initialMemos` 등 | 서버가 조회한 초기 카드 |
| `boardId` | API 대상 보드 |
| `boardZoom`, `cardLocationRef` | 새 카드 자동 위치 계산 |
| `setPermissionMessage` | 403 응답 문구를 화면에 띄운다 |
| `onPreviewUpdate` | 성공 시 보드 미리보기 갱신 예약 |

## 임시 카드

새 카드는 먼저 음수 id(`-Date.now()`)로 화면에 올라간다. 저장이 끝나기 전에도 편집을 시작할 수 있게 하기 위해서다.

`handleInsert*`가 성공하면 응답으로 받은 **DB 발급 id를 가진 행으로 임시 카드를 교체한다.** 실패하면 권한 문구를 띄우고 임시 카드는 그대로 남는다.

`useCardLayer`는 `id < 0`이면 레이어 변경을 시작하지 않는다. 아직 서버에 없는 카드다.

## 저장 흐름

| 핸들러 | 요청 | 성공 시 |
| --- | --- | --- |
| `handleInsert*` | `POST /api/{종류}` | 임시 카드를 응답 행으로 교체, `onPreviewUpdate()` |
| `handleUpdate*` | `PATCH /api/{종류}/{id}` | 해당 카드 필드 갱신, `onPreviewUpdate()` |
| `handleDelete*` | `DELETE /api/{종류}/{id}` | 컬렉션에서 제거 |

응답이 `ok`가 아니면 `setPermissionMessage`로 문구를 띄우고 상태를 바꾸지 않는다. 삭제는 미리보기를 갱신하지 않는다.

## 새 카드 위치

`cardLocationRef`(보드 스크롤 레이어)의 현재 뷰포트 중앙에 놓는다.

```text
x = max(0, (scrollLeft + clientWidth / 2) / zoom - 카드너비/2)
y = max(0, (scrollTop + clientHeight / 2) / zoom - 카드높이/2)
```

`sortOrder`는 클라이언트가 정하지 않는다. `POST /api/memos`가 INSERT 안에서 그 보드의 최대값 + 1을 구한다.

## `useCardLayer`

계산을 서버가 한다. 훅은 요청을 보내고 응답으로 받은 `z` 목록을 네 컬렉션에 반영한다.

1. `id < 0`이면 종료한다.
2. `POST /api/cards/layer`에 `{ boardId, type, id, action }`을 보낸다.
3. 응답의 `cards`를 `type:id` 맵으로 만들어 `applyCardLayers`가 네 컬렉션의 `z`를 한 번에 갱신한다.

이미지만 키가 `imageId`다.

Free는 같은 계산을 브라우저에서 하고 요청이 없다.

## `useBoardImages`

이미지만 흐름이 하나 더 있다. 파일을 고르면 낙관적 임시 카드를 먼저 띄우고, `POST /api/images`가 Cloudinary 업로드를 마친 뒤 돌려주는 `publicId`/`secureUrl`로 교체한다. 삭제는 `publicId`를 함께 보내 원본 자산도 지운다.

Free는 업로드가 없어 압축이 끝나는 즉시 최종 카드가 된다.
