# Board Preview 상세설계

소스: `hooks/useBoardPreview.ts`, `app/api/boards/[boardId]/preview/route.ts`, `app/page.tsx`, `lib/board-preview.ts`

## 목적

보드 목록에서 각 보드 페이지를 `iframe`으로 다시 실행하지 않고, 현재 보드 뷰포트의 정적 WebP 스냅샷을 표시한다. 보드별 Cloudinary 파일명을 고정해 갱신 시 기존 파일을 덮어쓴다.

## 클라이언트 입력

| 값 | 타입 | 역할 |
| --- | --- | --- |
| `boardId` | `number` | 캡처 업로드 API와 저장 경로 식별 |
| `boardViewportRef` | `RefObject<HTMLDivElement>` | 캡처할 `.board-scroll-layer` 뷰포트 |

## 예약 상태

| Ref | 역할 |
| --- | --- |
| `updateTimerRef` | 500ms debounce 타이머 |
| `updateRequestedRef` | 현재 또는 다음 업로드가 필요한지 표시 |
| `uploadInProgressRef` | 중복 업로드 루프 진입 방지 |

`schedulePreviewUpdate()`는 요청 플래그를 세우고 기존 타이머를 초기화한다. 500ms 뒤 `uploadPendingPreview()`를 시작한다.

업로드 중 다시 예약되면 별도 Promise를 병렬 실행하지 않는다. 현재 업로드가 끝난 뒤 `do...while (updateRequestedRef.current)`로 최신 화면을 한 번 더 캡처한다.

## 캡처 흐름

1. 두 번의 `requestAnimationFrame`으로 React 렌더와 레이아웃 반영을 기다린다.
2. 뷰포트가 없거나 크기가 0이면 종료한다.
3. 현재 뷰포트와 교차하는 이미지 카드의 `<img>`만 수집한다.
4. `image.decode()`가 끝날 때까지 기다린다.
5. `html-to-image.toCanvas()`로 뷰포트를 캡처한다.
6. 이미지 카드의 `<img>`는 filter로 DOM 캡처에서 제외한다.
7. 제외했던 이미지를 실제 화면 rect와 `object-contain` 비율에 맞춰 Canvas에 직접 그린다.
8. Canvas를 품질 0.8의 WebP Blob으로 변환한다.
9. `PreviewIMG.webp`라는 FormData 파일로 미리보기 API에 PUT한다.

캡처 실패는 화면 동작을 중단하지 않고 console error로만 남긴다. 미리보기는 보드 데이터의 영속화 성공 여부에 영향을 주지 않는 보조 데이터다.

## 최초 생성

`boardPreviewSessionKey` 값은 `kyuboard-preview-board-id`다.

- 새 보드 생성 성공 시 `useBoardList`가 sessionStorage에 새 ID를 기록한다.
- 목록에서 미리보기가 없거나 로드에 실패한 보드를 열 때도 같은 ID를 기록한다.
- 보드 마운트 시 값이 현재 `boardId`와 같으면 키를 삭제하고 캡처를 예약한다.

## Preview API

```text
PUT /api/boards/[boardId]/preview
```

1. 현재 사용자와 카드 편집 권한을 검사한다.
2. 양의 정수 boardId와 보드 존재 여부를 검사한다.
3. PNG/WebP, 0바이트 초과, 최대 4MiB 파일만 허용한다.
4. Cloudinary 환경 변수를 확인한다.
5. 다음 옵션으로 upload stream을 실행한다.

```text
folder: kyuboard/boards/{boardId}
public_id: PreviewIMG
format: webp
overwrite: true
invalidate: true
```

성공 응답은 `publicId`, `secureUrl`, 크기, bytes, format을 반환한다. 미리보기 메타데이터는 DB에 저장하지 않는다.

## 목록 표시

`app/page.tsx`는 DB에서 보드만 한 번 조회하고 보드 ID로 미리보기 URL을 계산한다. `BoardList`는 파일 로드 실패 시 점 패턴 fallback을 표시한다. 따라서 목록의 DB 조회 횟수는 미리보기 개수에 따라 증가하지 않는다.

## 현재 갱신 트리거

- Memo/Image/Mermaid/Table INSERT 성공
- Memo/Image/Mermaid/Table UPDATE 성공
- Drawing PATCH 성공
- 새 보드 또는 미리보기 실패 보드 최초 진입

DELETE와 카드 레이어 변경은 현재 예약 콜백을 호출하지 않는다.
