import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@meldrift/board-data/board-state";
import { compileBoardMarkdownDocument } from "@meldrift/board-data/board-markdown";
import { resolveMemoCornerLinks } from "@meldrift/core/cards";

const hoisted = vi.hoisted(() => {
    const persistenceCalls = vi.fn();
    let loadedSnapshot: BoardSnapshot | null = null;

    return {
        persistenceCalls,
        getLoadedSnapshot: () => loadedSnapshot,
        setLoadedSnapshot: (next: BoardSnapshot | null) => {
            loadedSnapshot = next;
        },
        createDiagramRenderer: (container: HTMLElement) => {
            const root = document.createElement("div");
            root.className = "meldrift-diagram-renderer";
            container.append(root);
            return {
                element: root,
                getSource: () => "",
                setSource: vi.fn(async () => {}),
                setCursor: vi.fn(),
                destroy: vi.fn(() => root.remove()),
            };
        },
        createDiagramEditor: (container: HTMLElement) => {
            const root = document.createElement("div");
            root.className = "meldrift-diagram-editor";
            container.append(root);
            return {
                element: root,
                setValue: vi.fn(),
                insertPaletteItem: vi.fn(),
                destroy: vi.fn(() => root.remove()),
            };
        },
    };
});

vi.mock("@meldrift/diagram-engine", () => ({
    createDiagramRenderer: hoisted.createDiagramRenderer,
    createDiagramEditor: hoisted.createDiagramEditor,
}));

vi.mock("@/hooks/useBoardLoad", () => ({
    useBoardLoad: () => ({
        initialSnapshot: hoisted.getLoadedSnapshot(),
        databaseError: "",
    }),
}));

vi.mock("@/hooks/useBoardPersistance", () => ({
    useBoardPersistance: (args: unknown) => {
        hoisted.persistenceCalls(args);
    },
}));

vi.mock("@/hooks/useBoardTransfer", () => ({
    useBoardTransfer: () => ({
        importInputRef: { current: null },
        transferring: false,
        resetting: false,
        handleExport: vi.fn(),
        handleImport: vi.fn(),
        handleReset: vi.fn(),
    }),
}));

import BoardClient from "@/components/BoardClient";
import TutorialBoardClient from "@/components/TutorialBoardClient";
import { buildTutorialShowcaseSnapshot } from "@/lib/tutorial";

function createPopulatedSnapshot(): BoardSnapshot {
    const empty = createEmptyBoardSnapshot();
    return {
        ...empty,
        memos: [
            {
                id: 1,
                syncId: "memo-1",
                boardId: empty.board.boardId,
                content: "Existing memo content",
                color: "#fffadc",
                sortOrder: 1,
                x: 100,
                y: 120,
                z: 1,
                width: 300,
                height: 200,
            },
        ],
    };
}

describe("Meldrift Interactive Tutorial", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        hoisted.setLoadedSnapshot(createEmptyBoardSnapshot());
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: RequestInfo | URL) => {
                const url = String(input);
                if (url.includes("Help_Meldrift.md")) {
                    return new Response("# Meldrift Help\nQuick guide");
                }
                return new Response(new Uint8Array([137, 80, 78, 71]), {
                    status: 200,
                    headers: { "Content-Type": "image/png" },
                });
            }),
        );
    });

    it("does not force help or tutorial for existing users with content, and shows 3 English menus only after HelpModal closes", async () => {
        hoisted.setLoadedSnapshot(createPopulatedSnapshot());

        render(<BoardClient />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Help quick actions" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Interactive tutorial guide")).not.toBeInTheDocument();

        fireEvent.keyDown(document, { key: "p", code: "KeyP", ctrlKey: true, shiftKey: true });

        await screen.findByText(/Quick guide/);
        fireEvent.keyDown(document, { key: "Escape" });

        await waitFor(() => {
            expect(screen.queryByText(/Quick guide/)).not.toBeInTheDocument();
        });

        const quickActions = screen.getByRole("navigation", { name: "Help quick actions" });
        expect(quickActions).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Tutorial" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Close (Esc)" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Help" }));
        await screen.findByText(/Quick guide/);

        fireEvent.click(screen.getByRole("button", { name: /close/i }));
        await waitFor(() => {
            expect(screen.getByRole("navigation", { name: "Help quick actions" })).toBeInTheDocument();
        });

        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => {
            expect(screen.queryByRole("navigation", { name: "Help quick actions" })).not.toBeInTheDocument();
        });
    });

    it("launches sandbox tutorial when clicking Tutorial after first-time HelpModal closes and returns cleanly without persistence writes or re-opening Help", async () => {
        hoisted.setLoadedSnapshot(createEmptyBoardSnapshot());

        render(<BoardClient />);

        await screen.findByText(/Quick guide/);
        fireEvent.click(screen.getByRole("button", { name: /close/i }));

        fireEvent.click(await screen.findByRole("button", { name: "Tutorial" }));

        expect(await screen.findByLabelText("Interactive tutorial guide")).toBeInTheDocument();
        expect(screen.getByText("Create & Edit a Memo Card")).toBeInTheDocument();

        const persistenceCallCountOnEnter = hoisted.persistenceCalls.mock.calls.length;

        fireEvent.click(screen.getByRole("button", { name: "Create memo" }));
        expect(hoisted.persistenceCalls.mock.calls.length).toBe(persistenceCallCountOnEnter);

        fireEvent.click(screen.getByRole("button", { name: "Exit tutorial" }));

        await waitFor(() => {
            expect(screen.queryByLabelText("Interactive tutorial guide")).not.toBeInTheDocument();
        });
        expect(screen.queryByText(/Quick guide/)).not.toBeInTheDocument();
    });

    it("builds valid 50px memo corner links for showcase cards in Step 3", () => {
        const showcase = buildTutorialShowcaseSnapshot({ x: 200, y: 240 }, new Uint8Array([1, 2, 3]));

        expect(showcase.memos).toHaveLength(2);
        expect(showcase.images).toHaveLength(1);
        expect(showcase.tables).toHaveLength(1);
        expect(showcase.mermaids).toHaveLength(1);

        const links = resolveMemoCornerLinks(showcase.memos, [
            ...showcase.images.map((image) => ({
                type: "image" as const,
                id: image.imageId,
                x: image.x,
                y: image.y,
                z: image.z,
                width: image.width,
                height: image.height,
            })),
            ...showcase.tables.map((table) => ({
                type: "table" as const,
                id: table.id,
                x: table.x,
                y: table.y,
                z: table.z,
                width: table.width,
                height: table.height,
            })),
            ...showcase.mermaids.map((mermaid) => ({
                type: "mermaid" as const,
                id: mermaid.id,
                x: mermaid.x,
                y: mermaid.y,
                z: mermaid.z,
                width: mermaid.width,
                height: mermaid.height,
            })),
        ]);

        expect(links.length).toBeGreaterThanOrEqual(3);
    });

    it("walks through Steps 1 to 6 in TutorialBoardClient, including showcase generation, 50px zone overlay, and Markdown compile modal", async () => {
        const onExit = vi.fn();

        render(<TutorialBoardClient onExit={onExit} />);

        // Step 1: Memo creation + padding glow highlight (no border ring)
        expect(screen.getByText("Create & Edit a Memo Card")).toBeInTheDocument();
        expect(screen.getByText("# Heading")).toBeInTheDocument();
        const highlightStyle = document.querySelector("style");
        expect(highlightStyle?.textContent).toContain("meldriftTutorialPaddingGlow");
        expect(highlightStyle?.textContent).toContain("inset 0 0");
        expect(highlightStyle?.textContent).not.toContain("0 0 0 2px");
        fireEvent.click(screen.getByRole("button", { name: "Create memo" }));

        // Step 2: Table, Mermaid, and Image note
        fireEvent.click(screen.getByRole("button", { name: /Step/ }));
        expect(screen.getByText("Create Table & Mermaid Cards")).toBeInTheDocument();
        expect(screen.getByText(/Image cards:/)).toBeInTheDocument();

        // Step 3: Showcase auto-generation
        fireEvent.click(screen.getByRole("button", { name: /Step/ }));
        expect(screen.getByText("Meldrift Showcase Board")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText(/Welcome to Meldrift/)).toBeInTheDocument();
            expect(screen.getByText("Structured grid data")).toBeInTheDocument();
        });

        // Step 4: 50px corner linking explanation + SVG 50px rings
        fireEvent.click(screen.getByRole("button", { name: /Step/ }));
        expect(screen.getByText("50px Memo Corner Linking")).toBeInTheDocument();
        expect(screen.getByText("50px Link Zone")).toBeInTheDocument();
        expect(screen.getByText(/Active links:/)).toBeInTheDocument();

        // Step 5: Compile to Markdown + Download guidance banner above modal
        fireEvent.click(screen.getByRole("button", { name: /Step/ }));
        expect(screen.getByText("Compile to Markdown & Download")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Open board menu" }));
        fireEvent.click(screen.getByRole("button", { name: "Compile to Markdown" }));

        const previewGuide = await screen.findByLabelText("Tutorial Markdown preview guide");
        expect(previewGuide.parentElement).toBe(document.body);
        expect(previewGuide).toHaveStyle({ zIndex: "60002" });
        expect(screen.getByRole("button", { name: "Download Markdown" })).toBeInTheDocument();
        expect(screen.getByText(/Download button at the top-right/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Exit tutorial" })).not.toHaveClass("ui-button-menu");

        const showcaseMarkdown = compileBoardMarkdownDocument(
            buildTutorialShowcaseSnapshot({ x: 200, y: 240 }, new Uint8Array([1, 2, 3])),
        ).markdown;
        expect(showcaseMarkdown).toContain("# Welcome to Meldrift");
        expect(showcaseMarkdown).not.toContain("    \n-");

        fireEvent.click(screen.getByRole("button", { name: "Close Markdown view" }));
        await waitFor(() => {
            expect(screen.queryByLabelText("Tutorial Markdown preview guide")).not.toBeInTheDocument();
        });

        // Step 6: Reorder Memos & Re-compile
        fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
        expect(screen.getByText("Reorder Memos & Re-Compile")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Open board menu" }));
        fireEvent.click(screen.getByRole("button", { name: "Reorder Memos" }));
        expect(screen.getByText("Memo Order")).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Close Tutorial" }));
        });
        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("keeps the Upload image file input label unique and hides HelpCanvasMenu when board panels open", () => {
        hoisted.setLoadedSnapshot(createEmptyBoardSnapshot());

        render(<BoardClient />);

        expect(screen.getAllByLabelText("Upload image")).toHaveLength(1);
        expect(screen.getByLabelText("Upload image").tagName).toBe("INPUT");
        expect(screen.getByRole("button", { name: "Add image" })).toHaveAttribute(
            "data-tutorial",
            "upload-image",
        );

        fireEvent.click(screen.getByRole("button", { name: "Close Help" }));
        const quickActions = screen.getByRole("navigation", { name: "Help quick actions" });
        expect(quickActions).toHaveClass("z-49999", "left-4", "top-17");

        fireEvent.click(screen.getByRole("button", { name: "Open board menu" }));
        expect(screen.queryByRole("navigation", { name: "Help quick actions" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Reorder Memos" }));
        expect(screen.queryByRole("navigation", { name: "Help quick actions" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Close memo order" }));
        expect(screen.getByRole("navigation", { name: "Help quick actions" })).toBeInTheDocument();
    });
});
