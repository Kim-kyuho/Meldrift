"use client";

import { ACTIVE_CARD_Z } from "@meldrift/core/cards";
import type { SelectionOffset, SelectionRect } from "@meldrift/core/cards";

type SelectionLayerProps = {
    marqueeRect: SelectionRect | null;
    selectionBounds: SelectionRect | null;
    selectionOffset: SelectionOffset;
};

export default function SelectionLayer({
    marqueeRect,
    selectionBounds,
    selectionOffset,
}: SelectionLayerProps) {
    return (
        <>
            {selectionBounds && (
                <div
                    data-selection-box="true"
                    className="card-editing pointer-events-none absolute"
                    style={{
                        left: selectionBounds.x + selectionOffset.x,
                        top: selectionBounds.y + selectionOffset.y,
                        width: selectionBounds.width,
                        height: selectionBounds.height,
                        zIndex: ACTIVE_CARD_Z,
                    }}
                />
            )}
            {marqueeRect && (
                <div
                    data-selection-marquee="true"
                    className="pointer-events-none absolute border border-pink-500 bg-pink-500/10"
                    style={{
                        left: marqueeRect.x,
                        top: marqueeRect.y,
                        width: marqueeRect.width,
                        height: marqueeRect.height,
                        zIndex: ACTIVE_CARD_Z,
                    }}
                />
            )}
        </>
    );
}
