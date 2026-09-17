# BoardClient 상세설계 (Free)

소스: `app/page.tsx`, `components/BoardClient.tsx`, `components/BoardControls.tsx`, `hooks/useBoardLoad.ts`, `hooks/useBoardPersistance.ts`

보드 화면 자체는 [공유 BoardClient](../shared/board-client.md)다. Free가 가진 것은 **불러오기와 저장, 그리고 껍데기**뿐이다.

## 세 파일이 하는 일

| 파일 | 역할 |
| --- | --- |
| `hooks/useBoardLoad.ts` | 마운트 후 워커에서 스냅샷을 한 번 읽는다 |
| `components/BoardClient.tsx` | 읽기 전/실패 화면을 그리고, 읽히면 공유 BoardClient에 넘긴다 |
| `components/BoardControls.tsx` | 보드 메뉴·Help·반출입·자동 저장을 `renderControls` 자리에 그린다 |

`app/page.tsx`는 `BoardClient`를 그리는 것 외에 하는 일이 없다.

## 불러오기

`useBoardLoad`는 `loadBoardState()` 하나를 부르고 결과를 상태로 돌려준다.

| 반환값 | 의미 |
| --- | --- |
| `initialSnapshot` | 읽힌 스냅샷. 읽기 전에는 `null` |
| `databaseError` | 워커 초기화 실패 문구 |

`active` 플래그로 언마운트 후 setState를 막는다.

`BoardClient`는 이 값으로 세 갈래를 그린다.

```text
databaseError    → 브라우저 SQLite 안내 화면
initialSnapshot 없음 → 제품 소개 + Loading...
그 외            → <SharedBoardClient initialSnapshot={...} renderControls={...} />
```

**빈 보드를 먼저 띄우고 나중에 채우지 않는다.** 그렇게 하면 읽기 전의 빈 스냅샷이 자동 저장에 실려 실제 데이터를 덮을 수 있다. 값이 있을 때만 편집기를 마운트하는 것이 그 방지책이다.

Help 모달은 읽힌 스냅샷이 비어 있을 때(`isBoardContentEmpty`) 처음부터 열린 상태로 시작한다.

## 자동 저장

`useBoardPersistance`가 `BoardControls` 안에서 돈다.

```text
조건: !savePaused && !resetting
지연: 150ms
동작: replaceBoardState(snapshot)
```

`snapshot`이 바뀔 때마다 타이머를 다시 건다. 언마운트하면 대기 중인 저장은 취소된다. 실패 문구는 `setMessage`로 보드 메시지에 띄운다.

`savePaused`는 공유 BoardClient가 계산해서 내려준다(편집 중·드로잉 중·AI 제안 대기). 여기에 Free만의 조건 하나를 더한다.

- **리셋 중**: 방금 지운 브라우저 DB가 저장으로 되살아나는 것을 막는다.

부분 갱신이 없다. 워커가 `DELETE` 후 전부 다시 INSERT하므로 한 번의 저장이 보드 전체를 다시 쓴다.

## 내보내기 잠금

```text
exportDisabled = savePaused
```

내보내기 직전에 저장을 한 번 더 부르므로, 잠그지 않으면 확정되지 않은 초안이 파일에 들어간다. 저장을 막는 이유와 같다.

## Help 단축키

`useBoardShortcuts`가 `window`에 캡처 단계로 `keydown` 리스너를 붙인다. `Ctrl` 또는 `⌘` + `Shift` + `H`에서 `preventDefault` 후 Help를 연다. 캡처 단계라 메모 편집기가 키를 삼켜도 동작한다.

Help를 열 때는 `closeOverlays()`로 메뉴·About·Markdown 뷰를 먼저 닫는다. 겹쳐 뜨는 것을 막는다.

## Plus와 갈리는 지점

| | Free | Plus |
| --- | --- | --- |
| 초기 데이터 | 마운트 후 워커에서 읽는다 | 서버가 보드 메타데이터만 내려주고, 스냅샷은 클라이언트가 받는다 |
| 저장 | `replaceBoardState` 한 번 | 브라우저 DB에 쓴 뒤 서버로 올린다 |
| 보드 | `defaultBoard` 하나 | 여러 개, 목록 화면 있음 |
| 인증 | 없음 | 로그인·승인·편집 리스 |
| 반출입 | `.sqlite` 세이브 파일 | 없음(서버가 원본을 들고 있다) |
