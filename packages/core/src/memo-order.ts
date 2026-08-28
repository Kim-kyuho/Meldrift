// 메모 순서는 보드 탐색 연번이자 Markdown 문서 순서의 기준이다.

type OrderedMemo = {
    id: number;
    sortOrder: number;
};

/** 포인터 위치를 줄 번호로 바꾸는 데 쓰므로 CSS의 줄 높이와 반드시 같아야 한다. */
export const memoReorderRowHeight = 44;

export const memoReorderVisibleRows = 5;

export const sortMemosByOrder = <T extends OrderedMemo>(memos: T[]) =>
    [...memos].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);

export const nextMemoOrder = (memos: { sortOrder: number }[]) =>
    memos.reduce((highest, memo) => Math.max(highest, memo.sortOrder), 0) + 1;

/** 순서 컬럼이 없던 시절의 파일은 값이 전부 0이라 id 순서로 떨어진다. 화면 연번은 늘 1..N이어야 한다. */
export function rankMemoOrders(memos: { id: number; storedOrder: number }[]) {
    return new Map(
        [...memos]
            .sort((left, right) => left.storedOrder - right.storedOrder || left.id - right.id)
            .map((memo, index) => [memo.id, index + 1] as const),
    );
}

export const memoPlainText = (content: string) =>
    content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();


export function reorderMemos<T extends OrderedMemo>(memos: T[], memoId: number, targetIndex: number): T[] {
    const sorted = sortMemosByOrder(memos);
    const fromIndex = sorted.findIndex((memo) => memo.id === memoId);

    if (
        fromIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= sorted.length ||
        targetIndex === fromIndex
    ) {
        return memos;
    }

    const fromOrder = sorted[fromIndex].sortOrder;
    const targetOrder = sorted[targetIndex].sortOrder;
    // 화면에서 위로 올라가는 것은 sortOrder 값이 작아지는 쪽이다. 두 방향 이름이 반대라
    // 헷갈리므로 값 기준으로 적는다. 사이에 낀 메모는 옮기는 메모와 반대로 밀린다.
    const toSmallerOrder = targetIndex < fromIndex;

    return memos.map((memo) => {
        if (memo.id === memoId) {
            return { ...memo, sortOrder: targetOrder };
        }
        if (toSmallerOrder && memo.sortOrder >= targetOrder && memo.sortOrder < fromOrder) {
            return { ...memo, sortOrder: memo.sortOrder + 1 };
        }
        if (!toSmallerOrder && memo.sortOrder > fromOrder && memo.sortOrder <= targetOrder) {
            return { ...memo, sortOrder: memo.sortOrder - 1 };
        }

        return memo;
    });
}
