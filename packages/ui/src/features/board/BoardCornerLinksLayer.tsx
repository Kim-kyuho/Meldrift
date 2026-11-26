"use client";

import type { MemoCornerLink } from "@meldrift/core/cards";

type BoardCornerLinksLayerProps = {
    links: MemoCornerLink[];
};

const linkPadding = 8;

function getLinksBounds(links: MemoCornerLink[]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const link of links) {
        minX = Math.min(minX, link.from.x, link.to.x);
        minY = Math.min(minY, link.from.y, link.to.y);
        maxX = Math.max(maxX, link.from.x, link.to.x);
        maxY = Math.max(maxY, link.from.y, link.to.y);
    }

    const left = Math.max(0, Math.floor(minX - linkPadding));
    const top = Math.max(0, Math.floor(minY - linkPadding));
    const right = Math.ceil(maxX + linkPadding);
    const bottom = Math.ceil(maxY + linkPadding);

    return {
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    };
}

export default function BoardCornerLinksLayer({ links }: BoardCornerLinksLayerProps) {
    if (links.length === 0) {
        return null;
    }

    const bounds = getLinksBounds(links);

    return (
        <svg
            aria-hidden="true"
            data-board-corner-links="true"
            className="pointer-events-none absolute overflow-visible"
            viewBox={`${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`}
            style={{
                left: `${bounds.left}px`,
                top: `${bounds.top}px`,
                width: `${bounds.width}px`,
                height: `${bounds.height}px`,
                zIndex: 0,
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
