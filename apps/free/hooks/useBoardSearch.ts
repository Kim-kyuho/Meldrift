import { useMemo, useState } from "react";

type SearchMemo = {
    id: number;
    content: string;
};

type UseBoardSearchOptions = {
    memos: SearchMemo[];
    focusMemoById: (memoId: number | null) => void;
    setMemoMessage: (message: string) => void;
};

export function useBoardSearch({
    memos,
    focusMemoById,
    setMemoMessage,
}: UseBoardSearchOptions) {
    const [searchBarOpen, setSearchBarOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchIndex, setSearchIndex] = useState(0);

    const searchResults = useMemo(() => {
        const query = searchText.trim().toLowerCase();

        if (!query) {
            return [];
        }

        return memos.filter((memo) =>
            memo.content.toLowerCase().includes(query)
        );
    }, [memos, searchText]);

    const focusSearchResult = (index: number) => {
        const targetMemo = searchResults[index];

        if (!targetMemo) {
            setMemoMessage("No search results.");
            return;
        }

        setSearchIndex(index);
        focusMemoById(targetMemo.id);
    };

    const handleSearchNext = () => {
        if (searchResults.length === 0) {
            setMemoMessage("No search results.");
            return;
        }

        const nextIndex = searchIndex >= searchResults.length - 1
            ? 0
            : searchIndex + 1;

        focusSearchResult(nextIndex);
    };

    const handleSearchPrev = () => {
        if (searchResults.length === 0) {
            setMemoMessage("No search results.");
            return;
        }

        const prevIndex = searchIndex <= 0
            ? searchResults.length - 1
            : searchIndex - 1;

        focusSearchResult(prevIndex);
    };

    const handleSearchTextChange = (query: string) => {
        setSearchText(query);
        setSearchIndex(0);

        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return;
        }

        const firstMemo = memos.find((memo) =>
            memo.content.toLowerCase().includes(normalizedQuery)
        );

        if (firstMemo) {
            focusMemoById(firstMemo.id);
        }
    };

    return {
        searchBarOpen,
        setSearchBarOpen,
        searchText,
        searchIndex,
        searchResults,
        handleSearchTextChange,
        handleSearchPrev,
        handleSearchNext,
    };
}
