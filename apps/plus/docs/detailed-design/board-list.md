# BoardList 상세설계

소스: `components/BoardList.tsx`, `hooks/useBoardList.ts`, `app/page.tsx`, `lib/board-preview.ts`

## 역할

보드 목록과 정적 미리보기를 표시하고, 인증 UI와 관리자 전용 생성·이름 변경·삭제 흐름을 조립한다. 실제 목록 상태와 보드 액션은 `useBoardList`, 인증 상태는 `useBoardAuth`가 소유한다.

## BoardList Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `boards` | `BoardListBoard[]` | `useBoardList`의 초기 목록 |

`BoardListBoard`는 `boardId`, `title`, `width`, `height`, `previewUrl`을 가진다. `app/page.tsx`는 DB에서 보드 목록을 조회한 뒤 Cloudinary cloud name이 있으면 다음 고정 URL을 조립한다.

```text
https://res.cloudinary.com/{cloudName}/image/upload/kyuboard/boards/{boardId}/PreviewIMG.webp
```

## 로컬 State

| State | 초기값 | 역할 |
| --- | --- | --- |
| `menuOpen` | `false` | `BoardMenu` 열림 상태 |
| `aboutOpen` | `false` | `AboutModal` 열림 상태, `BoardMenu`의 `onAbout`으로 설정 |
| `failedPreviewIds` | 빈 `Set` | 이미지 로드에 실패한 보드의 미리보기 재출력 방지 |

로그인·가입 모달과 현재 사용자는 `useBoardAuth`가 관리한다.

## `useBoardList` State

| State/Ref | 역할 |
| --- | --- |
| `boardList` | 이름 변경과 삭제가 반영되는 화면 목록 |
| `createBoardOpen` | 생성 모달 표시 여부 |
| `renameBoardOpen` | 이름 변경 모달 표시 여부 |
| `boardListMessage` | 관리자 권한 및 API 오류 메시지, `BoardMessage`의 `onDismiss`가 3500ms 후 빈 문자열로 되돌린다 |
| `actionMenuOpen` | 개별 `BoardActionMenu` 표시 여부 |
| `selectedBoardId` | 액션·삭제 대상 보드 ID |
| `selectedBoardTitle` | 이름 변경 모달의 초기 제목 |
| `deleteDialogOpen` | 삭제 확인 다이얼로그 표시 여부 |
| `menuRef` | 전역 `pointerdown`에서 메뉴 바깥 클릭을 판정하는 DOM Ref |

## 주요 흐름

### 보드 생성

1. `handleCreateBoardClick()`이 관리자 여부를 검사한다.
2. 생성 성공 시 `handleBoardCreated(boardId)`가 모달을 닫는다.
3. `sessionStorage[boardPreviewSessionKey]`에 새 보드 ID를 기록한다.
4. `/boards/{boardId}`로 이동한다.
5. 보드 화면의 `useBoardPreview`가 session 값을 소비해 최초 미리보기를 예약한다.

### 보드 열기와 미리보기 복구

`handleBoardClick(boardId, previewMissing)`은 액션 메뉴를 닫는다. URL이 없거나 `next/image`의 `onError`가 기록한 보드이면 sessionStorage에 ID를 기록해, 진입한 보드에서 미리보기를 다시 생성하게 한다.

### 이름 변경

`BoardActionMenu`에서 선택 ID와 현재 제목을 설정하고 `RenameBoardModal`을 연다. 성공 시 `handleBoardRenamed(boardId, title)`이 해당 목록 항목의 제목만 불변 업데이트한다.

### 삭제

관리자만 확인 다이얼로그를 열 수 있다. 서버는 보드 존재와 Cloudinary 설정을 확인하고, 해당 보드의 이미지 원본과 `kyuboard/boards/{boardId}/PreviewIMG`를 Cloudinary에서 삭제한 뒤 관련 `images`, `memos`, `mermaids`, `drawings`, `tables`, `boards` 행을 순서대로 삭제한다. 성공 시 클라이언트는 목록에서 해당 보드를 제거하고 선택 상태를 초기화한 뒤 `router.refresh()`로 서버 데이터를 재검증한다.

## 렌더 구조

```text
BoardMenu
├ AboutModal
├ SignInModal / SignUpModal
├ CreateBoardModal / RenameBoardModal
├ BoardMessage
└ main
   └ board grid
      ├ board card[]
      │  ├ Link / static preview image / title
      │  ├ EllipsisVertical button
      │  └ BoardActionMenu (선택된 한 항목만)
      └ New Board button
ConfirmDialog
```

### 보드 카드

- 미리보기 영역은 16:9이며 점 패턴을 fallback 배경으로 사용한다.
- 유효한 `previewUrl`이 있으면 `next/image`를 `fill`, `object-cover`, `unoptimized`로 렌더링한다.
- 미리보기 로드 실패 시 해당 ID를 `failedPreviewIds`에 추가하고 fallback 배경만 남긴다.
- 카드 전체 `Link`는 `/boards/{boardId}`로 이동한다.
- 우상단 액션 버튼은 `pointerdown`과 `click` 전파를 막아 부모 Link가 실행되지 않게 한다.
- 액션 메뉴는 `actionMenuOpen && selectedBoardId === board.boardId`인 항목 하나에만 렌더링된다.

## 알려진 특이사항

- 미리보기 URL은 DB 컬럼이 아니라 보드 ID와 Cloudinary 경로 규칙으로 계산한다.
- `previewUrl`은 실제 파일 존재 여부를 보장하지 않으므로 클라이언트의 이미지 오류 상태가 필요하다.
- 새 보드와 미리보기 실패 보드의 최초 캡처 요청은 sessionStorage 단일 키를 통해 다음 보드 화면으로 전달된다.
- 삭제 실패 시 선택 ID는 유지되고 다이얼로그만 닫힌다.
- 외래키 cascade 대신 보드 삭제 API가 관계 행과 Cloudinary 자산을 명시적으로 정리한다.
