# Meldrift Free Edition 기본 설계

## 제품 범위

Meldrift Free Edition은 로그인과 보드 목록이 없는 단일 사용자·단일 보드 앱이다. `/`에서 고정 `board_id = 1`을 바로 열며 서버 데이터베이스나 서버 파일 업로드 기능은 없다.

예외는 AI 어시스턴트 하나다. 모델 호출에는 서버가 필요하므로 `app/api/ai/*`에 라우트가 있고, 로그인이 없는 대신 어시스턴트 자체에 비밀번호가 걸려 있다. 환경변수를 넣지 않으면 어시스턴트는 꺼진 상태가 되고 나머지 기능은 그대로 동작한다. 자세한 내용은 `detailed-design/ai-assistant.md`를 본다.

## 실행 구조

```text
Next.js page (/)
  └─ BoardClient (React state)
       ├─ 카드/드로잉 편집
       ├─ 클라이언트 Markdown 컴파일/ZIP 생성
       └─ browser-db client (RPC)
            └─ Web Worker
                 ├─ SQLite WASM in-memory DB
                 └─ 전용 IndexedDB (`files/database`)
```

CRUD 및 Export/Import를 포함한 **데이터 작업에는 Next API Route나 서버 파일시스템을 사용하지 않는다.** Worker는 작업을 순서대로 실행해 저장, Export, Import가 서로 끼어들지 않게 한다.

AI 어시스턴트 라우트는 이 흐름 밖에 있다. 보드 데이터를 서버로 보내지도, 서버가 SQLite를 만지지도 않는다. 모델에 보내는 것은 대화와 카드 요약뿐이고, 돌아온 계획을 보드에 반영하는 일은 클라이언트가 한다.

## 데이터 모델

| 테이블 | 내용 |
| --- | --- |
| `boards` | 단일 보드 제목과 크기 |
| `memos` | TipTap HTML, 색상, 위치, 크기, 레이어 |
| `images` | 압축 이미지 BLOB, MIME 타입, 라벨, 위치, 크기, 레이어; v1 호환 URL |
| `mermaids` | Mermaid 소스와 카드 geometry |
| `tables` | `TableSource` JSON과 카드 geometry |
| `drawings` | 보드별 `BoardStroke[]` JSON |

표와 드로잉 JSON은 SQLite `json_valid` CHECK와 Zod snapshot schema로 검증한다. 모든 카드 행은 보드 foreign key와 `ON DELETE CASCADE`를 사용한다.

## 저장 흐름

최초 진입 시 Worker가 WASM을 초기화하고 IndexedDB에 보존된 SQLite 파일 바이트를 deserialize한다. 데이터가 없으면 메모리 DB에 스키마와 기본 보드를 만든다. 이후 전체 snapshot을 React 상태로 전달한다.

카드 훅은 네트워크 요청 없이 React 상태를 갱신한다. `BoardClient`는 카드 편집, 드로잉 모드, 저장하지 않은 AI 제안이 모두 아닐 때 변경된 전체 snapshot을 150ms debounce 후 하나의 SQLite 트랜잭션으로 저장한다. 드로잉 완료 시에도 같은 저장 흐름을 사용한다.

## 로컬 이미지

이미지 버튼은 숨겨진 파일 입력을 연다. JPEG, PNG, WebP 원본을 Canvas에서 긴 변 1920px 이하의 WebP로 압축하고, 최대 5 MiB인 결과 바이트를 SQLite BLOB에 저장한다. 카드와 Markdown 미리보기는 필요한 동안에만 Object URL을 만들어 표시하고 사용이 끝나면 해제한다. Object URL을 해제해도 SQLite BLOB은 삭제되지 않는다. Export/Import 파일에도 이미지 자체가 포함된다. 기존 schema v1의 HTTP(S) URL 이미지는 v2로 자동 마이그레이션해 계속 읽는다.

## Markdown 컴파일

Compile to Markdown은 현재 React snapshot만 사용하며 서버 API나 DB 재조회 없이 브라우저에서 실행한다. 메모의 TipTap HTML을 Markdown으로 바꾸고, 기존 규칙에 따라 메모 모서리와 겹치는 최상단 이미지·Mermaid·표를 문서에 한 번씩 삽입한다. 메모와 연결되지 않은 카드나 겹치더라도 메모 모서리를 포함하지 않는 카드는 컴파일 대상이 아니다.

로컬 이미지 참조는 `./images/image-{imageId}.png` 형식이다. 미리보기에서는 SQLite에 저장된 원본 압축 바이트로 임시 Blob URL을 만들어 이 경로에 대응시킨다. 다운로드할 때만 JPEG/WebP 바이트를 PNG로 변환하고 Markdown과 함께 `meldrift-board-{boardId}.zip`으로 묶는다. 기존 v1 HTTP(S) URL 이미지는 외부 URL을 Markdown에 유지하며 ZIP에 복사하지 않는다.

```text
meldrift-board-{boardId}.zip
├── board-{boardId}.md
└── images/
    └── image-{imageId}.png
```

이 다운로드는 읽기 가능한 문서를 내보내는 기능이다. 전체 작업 상태를 백업·복원하는 아래 SQLite Export/Import와는 별개이며 IndexedDB의 저장 형식이나 이미지 BLOB을 변경하지 않는다.

## Export

Export 직전에 현재 snapshot 저장 RPC가 완료될 때까지 기다린 뒤 SQLite 메모리 DB를 serialize해 `meldrift-free.sqlite`로 다운로드한다. 카드 편집, 드로잉 모드, 저장하지 않은 AI 제안 중에는 미완성 draft가 생길 수 있으므로 Export를 비활성화한다.

## Import

사용자가 현재 보드 교체를 확인하면 파일을 Worker로 전송하고 다음을 검증한다.

1. SQLite 헤더
2. `PRAGMA integrity_check`
3. `PRAGMA user_version`
4. 필수 테이블과 단일 `board_id = 1`
5. 모든 행의 타입, ID, geometry 및 보드 참조
6. 이미지 BLOB 크기와 MIME 타입 또는 v1 호환 HTTP(S) URL
7. 표와 드로잉 JSON의 Zod schema

가져온 파일은 별도 임시 SQLite 메모리 DB로 열기 때문에 검증 실패 시 현재 상태가 유지된다. 검증된 snapshot만 현재 DB의 단일 트랜잭션으로 교체하고 serialize된 전체 SQLite 파일을 IndexedDB에 원자적으로 저장한다.

## Reset

오른쪽 위 메뉴의 Reset은 확인 모달을 거친 뒤 현재 origin의 Meldrift Free Edition 전용 IndexedDB 데이터베이스를 삭제한다. 메모, 이미지 BLOB, Mermaid, 표, 드로잉을 담은 SQLite 파일 전체가 영구 삭제되고 페이지를 다시 열어 빈 기본 DB를 만든다. Reset 중에는 자동 저장과 Export/Import를 멈춰 삭제 직후 이전 snapshot이 다시 저장되지 않게 한다.

삭제 범위는 정확히 앱 전용 데이터베이스 하나다. 같은 origin의 다른 IndexedDB 데이터베이스, Cache Storage, localStorage, sessionStorage, 쿠키는 일괄 삭제하지 않는다. 삭제 자체가 실패하면 페이지를 새로고침하거나 더 넓은 저장소를 지우지 않고 오류를 표시해 기존 데이터를 유지한다.

## 배포 및 보존 범위

Vercel에는 Next.js 정적 페이지, Worker JavaScript, `sqlite3.wasm`과 AI 어시스턴트 라우트 세 개(`/api/ai/status`, `/api/ai/unlock`, `/api/ai/chat`)가 배포된다. 데이터는 배포 서버가 아니라 각 브라우저 origin의 IndexedDB에 있으므로 서버의 읽기 전용 파일시스템 문제가 없다.

어시스턴트를 쓰려면 `AI_API_KEY`와 `AI_PASSWORD`를 프로젝트 환경변수에 넣는다. 둘 다 서버에만 존재하고 클라이언트로 내려가지 않는다. 넣지 않으면 어시스턴트만 꺼지고 데이터베이스 관련 환경변수는 여전히 필요하지 않다.

브라우저 프로필·기기·origin 사이에는 자동 동기화되지 않는다. 사이트 데이터 삭제 시 작업 DB도 삭제되므로 사용자는 Export 파일을 별도 백업해야 한다. WebAssembly, Web Worker, IndexedDB를 지원하는 최신 브라우저가 필요하다.
