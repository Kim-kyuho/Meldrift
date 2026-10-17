"use client";

import { ACTIVE_CARD_Z, type MemoCornerLink } from "@meldrift/core/cards";

type BoardCornerLinksLayerProps = {
    links: MemoCornerLink[];
};

export default function BoardCornerLinksLayer({ links }: BoardCornerLinksLayerProps) {
    if (links.length === 0) {
        return null;
    }

    return (
        <svg
            aria-hidden="true"
            data-board-corner-links="true"
            className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible"
            style={{
                zIndex: ACTIVE_CARD_Z,
                pointerEvents: "none",
            }}
        >
            {links.map((link) => {
                const key = `${link.memoId}:${link.cornerIndex}:${link.cardType}:${link.cardId}`;
                return (
                    <g
                        key={key}
                        data-corner-link={`${link.memoId}:${link.cornerIndex}->${link.cardType}:${link.cardId}`}
                    >
                        <line
                            x1={link.from.x}
                            y1={link.from.y}
                            x2={link.to.x}
                            y2={link.to.y}
                            stroke="#000000"
                            strokeWidth={1}
                            strokeDasharray="4 3"
                            strokeLinecap="round"
                        />
                        <circle
                            cx={link.from.x}
                            cy={link.from.y}
                            r={2}
                            fill="#000000"
                        />
                        <circle
                            cx={link.to.x}
                            cy={link.to.y}
                            r={2}
                            fill="#000000"
                        />
                    </g>
                );
            })}
        </svg>
    );
}
