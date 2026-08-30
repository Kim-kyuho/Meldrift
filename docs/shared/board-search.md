# `useBoardSearch` 상세설계

소스: `packages/ui/src/hooks/useBoardSearch.ts`

검색 패널 자체는 [BoardSearchPanel](./board-search-panel.md)이다. 이 훅은 검색 상태와 결과 순회를 담당한다.

## 입력

| 값 | 타입 | 역할 |
| --- | --- | --- |
| `memos` | `{ id, content, sortOrder }[]` | 검색 대상 |
| `focusMemoById` | `(memoId: number \| null) => void` | 결과로 보드를 이동시킨다 |
| `setMemoMessage` | `(message: string) => void` | 결과 없음 안내 |

메모 전체 타입이 아니라 세 필드만 요구한다. 두 Edition의 메모 타입이 같아도 이 훅은 그 사실에 기대지 않는다.

## 상태

| 값 | 초기값 |
| --- | --- |
| `searchBarOpen` | `false` |
| `searchText` | `""` |
| `searchIndex` | `0` |

## 결과 계산

```text
sortedMemos   = useMemo(sortMemosByOrder(memos), [memos])
searchResults = useMemo(질의가 비면 [], 아니면 content에 질의가 든 메모, [sortedMemos, searchText])
```

질의는 `trim().toLowerCase()`하고 대상도 `toLowerCase()`해 대소문자를 구분하지 않는다. 부분 문자열 포함만 본다. 정규식이나 단어 경계는 쓰지 않는다.

결과 순서가 **문서 순서와 같다.** `sortMemosByOrder`를 먼저 거치므로 검색 결과를 순회하는 것이 문서를 훑는 것과 같은 순서가 된다.

`content`는 메모의 HTML 원문이다. 태그 이름이 질의에 걸릴 수 있다.

## 순회

`focusSearchResult(index)`가 해당 결과로 이동한다. 대상이 없으면 `No search results.`를 띄우고 끝낸다.

다음/이전은 결과 끝에서 반대편으로 돌아온다. 결과가 하나도 없으면 같은 안내를 띄운다.
