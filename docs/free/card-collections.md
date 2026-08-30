# 카드 컬렉션 훅 상세설계 (Free)

소스: `hooks/useBoardMemos.ts`, `hooks/useBoardImages.ts`, `hooks/useBoardMermaids.ts`, `hooks/useBoardTables.ts`, `hooks/useCardLayer.ts`

## Plus와 갈리는 지점

Plus의 같은 이름 훅들은 `handleInsert*`/`handleUpdate*`/`handleDelete*`에서 Route Handler를 호출하고 응답으로 받은 서버 id를 반영한다. Free는 **네트워크가 없다.** 같은 핸들러가 로컬 상태만 바꾸고, 영속화는 `BoardClient`의 자동 저장이 스냅샷 단위로 한꺼번에 처리한다.

| | Plus | Free |
| --- | --- | --- |
| 삽입 | `POST` → 서버가 발급한 id | `nextPositiveId`로 클라이언트가 발급 |
| 갱신 | `PATCH` | `setState`만 |
| 삭제 | `DELETE` | `setState`만 |
| 실패 처리 | 응답 실패 시 롤백·메시지 | 없다(네트워크가 없으므로) |
| 권한 | `canEditCard` 검사 | 없다 |

핸들러가 `async`로 남아 있는 것은 카드 컴포넌트가 두 Edition에서 같은 시그니처를 받기 위해서다. 실제로 기다릴 것은 없다.

## 임시 카드와 id

새 카드는 먼저 **음수 id**로 화면에 올라간다.

```text
id: -Date.now()
```

카드가 첫 저장(`handleInsert*`)을 통과할 때 `nextPositiveId(현재 id들)`로 양수 id를 받는다. `nextPositiveId`는 양수 중 최댓값 + 1이고, 비어 있으면 1이다.

음수 id는 두 곳에서 의미를 갖는다.

- `board-state`의 스키마가 양의 정수만 허용하므로, 임시 카드가 남아 있는 상태는 저장되지 않는다. `BoardClient`가 편집 중·AI 제안 대기 중에 자동 저장을 막는 이유와 같은 장치다.
- `useCardLayer`는 `id < 0`이면 레이어 변경을 하지 않는다.

이미지는 예외다. 업로드가 없어 압축이 끝나는 즉시 양수 id를 받고 임시 상태를 거치지 않는다.

## 새 카드 위치

메모·머메이드·표는 `cardLocationRef`(보드 스크롤 레이어)의 현재 뷰포트 중앙에 놓는다.

```text
x = max(0, (scrollLeft + clientWidth / 2) / zoom - 카드너비/2)
y = max(0, (scrollTop + clientHeight / 2) / zoom - 카드높이/2)
```

`ref`가 없으면 `(0, 0)`이다. 좌표는 반올림해서 넣는다.

## 기본값

| 카드 | 크기 | 그 밖 |
| --- | --- | --- |
| 메모 | 300 × 200 | `color: #fffadc`, `sortOrder: nextMemoOrder(memos)` |
| 머메이드 | 480 × 360 | |
| 표 | | `source: structuredClone(defaultTableSource)` |
| 이미지 | `prepareImageFile` 결과 | 긴 변 400 × 300 이내 |

새 카드의 `z`는 전부 `1`이다. 표의 기본 소스를 `structuredClone`하는 것은 여러 표가 같은 객체를 공유하지 않게 하기 위해서다.

## 이미지 추가

`useBoardImages`만 파일 입력을 다룬다.

1. 선택 직후 `event.target.value`를 비운다. 같은 파일을 다시 골라도 `change`가 발생한다.
2. `uploadingImage` 중이면 무시한다.
3. `prepareImageFile(file)`로 압축한다. 여기서 형식·크기 검증이 끝난다.
4. 뷰포트 중앙 좌표를 계산하고 양수 id를 발급해 컬렉션에 넣는다.
5. 곧바로 편집 상태로 만든다.

실패하면 예외 문구를 보드 메시지로 띄운다. 성공·실패 모두 `uploadingImage`를 되돌린다.

Plus의 같은 훅에 있는 낙관적 임시 카드, Cloudinary 업로드, `publicId` 반영 단계가 여기에는 없다.

## `useCardLayer`

레이어 계산 자체는 Plus의 Route Handler와 같은 규칙이지만, 계산 위치가 다르다. Free는 브라우저에서 계산하고 상태만 바꾼다.

1. `id < 0`이면 종료한다.
2. 네 컬렉션을 `{ type, id, z }`로 모아 `z` → `cardTypeOrder` → `id` 순으로 정렬한다.
3. 대상 카드를 빼내 `front`면 배열 끝, `back`이면 앞에 다시 넣는다.
4. 배열 순서대로 `z`를 `1..N`으로 다시 매긴다.
5. `type:id` 맵으로 네 컬렉션의 `z`를 한 번에 갱신한다.

새 카드가 전부 `z = 1`로 만들어지므로 동률이 기본 상태다. 그래서 2단계의 `cardTypeOrder` tiebreak가 상시 동작한다.

이미지만 키가 `imageId`다. 맵 조회도 `image:${image.imageId}`로 한다.

## 반환값 공통 형태

각 훅은 컬렉션, `setX`, `editingXId`, `setEditingXId`와 핸들러들을 돌려준다. `BoardClient`가 이것들을 모아 `snapshot`을 만들고, 그 스냅샷 하나가 브라우저 DB로 간다.
