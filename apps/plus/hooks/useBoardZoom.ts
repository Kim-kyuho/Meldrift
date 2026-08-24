import { useState } from "react";

export function useBoardZoom() {
    const [boardZoom, setBoardZoom] = useState(0.75);

    return {
        boardZoom,
        setBoardZoom,
    };
}
