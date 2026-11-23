import {
    createEmptyBoardSnapshot,
    createSyncId,
    type BoardImage,
    type BoardMemo,
    type BoardMermaid,
    type BoardSnapshot,
    type BoardTable,
} from "@meldrift/board-data/board-state";
import { sortMemosByOrder } from "@meldrift/core/memo-order";

export type TutorialStepId = 1 | 2 | 3 | 4 | 5 | 6;

export type TutorialStepMeta = {
    id: TutorialStepId;
    title: string;
    subtitle: string;
    summary: string;
    highlightTargets: string[];
};

export const TUTORIAL_STEPS: TutorialStepMeta[] = [
    {
        id: 1,
        title: "Create & Edit a Memo Card",
        subtitle: "Step 1 of 6 · Markdown Notes",
        summary: "Click the Memo button in the bottom-right toolbar (or press M). Write Markdown like # Heading, **bold**, or - list, drag or resize the card, and click empty canvas to save.",
        highlightTargets: ["create-memo"],
    },
    {
        id: 2,
        title: "Create Table & Mermaid Cards",
        subtitle: "Step 2 of 6 · Visual Cards & Images",
        summary: "Use the toolbar buttons (or shortcuts T and D) to create a Table card and a Mermaid diagram card, then click empty canvas to save each. Note: Image cards depend on local files (Camera button or drag-and-drop), so image creation is optional here.",
        highlightTargets: ["create-table", "create-mermaid"],
    },
    {
        id: 3,
        title: "Meldrift Showcase Board",
        subtitle: "Step 3 of 6 · Card Overview",
        summary: "The tutorial placed a complete set of Meldrift showcase cards on your sandbox board: explanatory Memos, an Image, a Table, and a Mermaid flowchart.",
        highlightTargets: [],
    },
    {
        id: 4,
        title: "50px Memo Corner Linking",
        subtitle: "Step 4 of 6 · Spatial Relationships",
        summary: "Any Image, Table, or Mermaid card within 50px of a Memo's corner links to that Memo. A black dashed connector line appears when nearby without overlapping, and hides when overlapping. Drag a showcase card near or away from the 50px rings to test it.",
        highlightTargets: [],
    },
    {
        id: 5,
        title: "Compile to Markdown & Download",
        subtitle: "Step 5 of 6 · Document Export",
        summary: "Open the top-right board menu (...) and select Compile to Markdown. Review how linked cards merge into Markdown, and note the Download button inside the preview to export your document (or ZIP archive with images).",
        highlightTargets: ["board-menu-trigger", "compile-markdown"],
    },
    {
        id: 6,
        title: "Reorder Memos & Re-Compile",
        subtitle: "Step 6 of 6 · Final Section Order",
        summary: "Open the top-right menu (...) and click Reorder Memos. Drag a memo handle to swap section order, then run Compile to Markdown again to verify the updated output order.",
        highlightTargets: ["board-menu-trigger", "reorder-memos", "compile-markdown"],
    },
];

export const tutorialTotalSteps = TUTORIAL_STEPS.length;

export function getTutorialStepMeta(step: TutorialStepId): TutorialStepMeta {
    return TUTORIAL_STEPS[step - 1];
}

export const tutorialSandboxTitle = "Meldrift Tutorial Sandbox";

export function createTutorialSandboxSnapshot(): BoardSnapshot {
    const empty = createEmptyBoardSnapshot();
    return { ...empty, board: { ...empty.board, title: tutorialSandboxTitle } };
}

export async function loadTutorialMascotBytes(mascotUrl: string): Promise<Uint8Array | null> {
    try {
        const response = await fetch(mascotUrl);
        if (!response.ok) {
            return null;
        }
        return new Uint8Array(await response.arrayBuffer());
    } catch {
        return null;
    }
}

export function getMemoOrderKey(memos: readonly Pick<BoardMemo, "id" | "sortOrder">[]): string {
    return sortMemosByOrder([...memos])
        .map((memo) => memo.id)
        .join(",");
}

export function buildTutorialShowcaseSnapshot(
    origin: { x: number; y: number },
    mascotUrl: string,
    mascotBytes: Uint8Array | null = null,
): BoardSnapshot {
    const base = createEmptyBoardSnapshot();
    const x = Math.max(80, Math.round(origin.x));
    const y = Math.max(120, Math.round(origin.y));
    const boardId = base.board.boardId;

    const memos: BoardMemo[] = [
        {
            id: 1,
            syncId: createSyncId(),
            boardId,
            content: [
                "<h1>Welcome to Meldrift</h1>",
                "<p>Meldrift turns <strong>freeform spatial cards</strong> into structured <strong>Markdown</strong>.</p>",
                "<ul>",
                "<li>Place Memos, Images, Tables, and Mermaid diagrams anywhere</li>",
                "<li>Attach cards within <strong>50px</strong> of any Memo corner</li>",
                "</ul>",
            ].join(""),
            color: "#fffadc",
            sortOrder: 1,
            x,
            y,
            z: 1,
            width: 340,
            height: 230,
        },
        {
            id: 2,
            syncId: createSyncId(),
            boardId,
            content: [
                "<h2>Order &amp; Export</h2>",
                "<ol>",
                "<li>Open <strong>Reorder Memos</strong> to change section order (#1, #2, ...).</li>",
                "<li>Run <strong>Compile to Markdown</strong> to preview and download.</li>",
                "</ol>",
            ].join(""),
            color: "#e0f2fe",
            sortOrder: 2,
            x: x + 410,
            y: y + 185,
            z: 2,
            width: 320,
            height: 200,
        },
    ];

    const images: BoardImage[] = [
        {
            imageId: 1,
            syncId: createSyncId(),
            boardId,
            assetId: "meldrift-mascot.png",
            url: mascotUrl,
            data: mascotBytes,
            mimeType: mascotBytes ? "image/png" : null,
            label: "Meldrift Mascot",
            x: x + 365,
            y: y - 10,
            z: 3,
            width: 145,
            height: 145,
        },
    ];

    const tables: BoardTable[] = [
        {
            id: 1,
            syncId: createSyncId(),
            boardId,
            x,
            y: y + 258,
            z: 4,
            width: 340,
            height: 165,
            source: {
                columns: [
                    { id: "card", name: "Card", width: 95 },
                    { id: "shortcut", name: "Shortcut", width: 85 },
                    { id: "role", name: "Role", width: 155 },
                ],
                rows: [
                    {
                        id: "row-1",
                        cells: { card: "Memo", shortcut: "m", role: "Markdown narrative" },
                    },
                    {
                        id: "row-2",
                        cells: { card: "Table", shortcut: "t", role: "Structured grid data" },
                    },
                    {
                        id: "row-3",
                        cells: { card: "Mermaid", shortcut: "d", role: "Diagrams & flowcharts" },
                    },
                ],
            },
        },
    ];

    const mermaids: BoardMermaid[] = [
        {
            id: 1,
            syncId: createSyncId(),
            boardId,
            x: x + 410,
            y: y + 412,
            z: 5,
            width: 320,
            height: 185,
            source: [
                "flowchart LR",
                '    A["Spatial Cards"] --> B["50px Corner Link"]',
                '    B --> C["Markdown Compile"]',
            ].join("\n"),
        },
    ];

    return {
        board: {
            ...base.board,
            title: tutorialSandboxTitle,
        },
        memos,
        images,
        mermaids,
        tables,
        strokes: [],
    };
}
