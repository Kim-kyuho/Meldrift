import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as imageFile from "@meldrift/board-data/image-file";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";
import BoardMarkdownView from "../src/features/markdown/BoardMarkdownView";
import { useLinearMarkdownDraft } from "../src/features/markdown/useLinearMarkdownDraft";

vi.mock("@meldrift/diagram-engine", () => ({
    createDiagramRenderer: (container: HTMLElement, options: { source?: string }) => {
        let source = options.source ?? "";
        const element = document.createElement("div");
        element.className = "mock-diagram";
        element.textContent = source;
        container.append(element);
        return {
            element,
            setSource: vi.fn(async (next: string) => {
                source = next;
                element.textContent = next;
            }),
            getSource: () => source,
            destroy: vi.fn(() => element.remove()),
        };
    },
    createDiagramEditor: (host: HTMLElement, options: { value?: string; onChange?: (next: string) => void }) => {
        const textarea = document.createElement("textarea");
        textarea.setAttribute("aria-label", "Mermaid source");
        textarea.value = options.value ?? "";
        textarea.addEventListener("input", () => options.onChange?.(textarea.value));
        textarea.addEventListener("change", () => options.onChange?.(textarea.value));
        host.append(textarea);
        return {
            getValue: () => textarea.value,
            setValue: (next: string) => { textarea.value = next; },
            destroy: () => textarea.remove(),
        };
    },
}));

vi.mock("../src/features/memo/MemoEditor", () => ({
    default: ({ content, onChange }: { content: string; onChange: (html: string) => void }) => (
        <textarea
            aria-label="Mock memo editor"
            value={content}
            onChange={(event) => onChange(event.target.value)}
        />
    ),
}));

vi.mock("../src/features/table/TableGrid", () => ({
    default: ({ source, onChange }: {
        source: { columns: Array<{ id: string; name: string }>; rows: Array<{ id: string; cells: Record<string, string> }> };
        onChange: (next: typeof source) => void;
    }) => (
        <button
            type="button"
            onClick={() => onChange({
                ...source,
                rows: [...source.rows, { id: "r-new", cells: { c1: "Added row" } }],
            })}
        >
            Mock add table row
        </button>
    ),
}));

function sampleSnapshot(): BoardSnapshot {
    return {
        ...createEmptyBoardSnapshot(),
        memos: [
            {
                id: 1, syncId: "m1", boardId: 1, content: "<h1>Alpha</h1><p>Body</p>",
                color: "#fffadc", sortOrder: 1, x: 80, y: 80, z: 1, width: 400, height: 200,
            },
            {
                id: 2, syncId: "m2", boardId: 1, content: "<h2>Beta</h2>",
                color: "#fffadc", sortOrder: 2, x: 80, y: 360, z: 2, width: 400, height: 200,
            },
        ],
        tables: [
            {
                id: 10, syncId: "t10", boardId: 1, x: 500, y: 80, z: 3, width: 360, height: 180,
                source: {
                    columns: [{ id: "c1", name: "Col" }],
                    rows: [{ id: "r1", cells: { c1: "Cell 1" } }],
                },
            },
        ],
        mermaids: [
            {
                id: 20, syncId: "d20", boardId: 1, x: 500, y: 360, z: 4, width: 480, height: 360,
                source: "flowchart LR\nA-->B",
            },
        ],
    };
}

function Harness({
    initial,
    canEdit = true,
    onCommitSpy,
}: {
    initial: BoardSnapshot;
    canEdit?: boolean;
    onCommitSpy: (snapshot: BoardSnapshot) => void;
}) {
    const [open, setOpen] = useState(true);
    const [committed, setCommitted] = useState(initial);
    const draft = useLinearMarkdownDraft({
        open,
        canEdit,
        committedSnapshot: committed,
        onCommit: (next) => {
            onCommitSpy(next);
            setCommitted(next);
            return true;
        },
        onClose: () => setOpen(false),
    });

    return (
        <div>
            <div data-testid="canvas-preview-first-memo">
                {draft.displaySnapshot.memos.find((m) => m.id === 1)?.content ?? ""}
            </div>
            <div data-testid="canvas-preview-memo-count">{draft.displaySnapshot.memos.length}</div>
            <div data-testid="committed-first-memo">
                {committed.memos.find((m) => m.id === 1)?.content ?? ""}
            </div>
            {open && (
                <BoardMarkdownView
                    snapshot={draft.displaySnapshot}
                    canEdit={canEdit}
                    isDirty={draft.isDirty}
                    applying={draft.applying}
                    closeConfirmOpen={draft.closeConfirmOpen}
                    onClose={draft.requestClose}
                    onApply={() => { void draft.applyDraft(); }}
                    onApplyAndClose={() => { void draft.handleApplyAndClose(); }}
                    onDiscardAndClose={draft.handleDiscardAndClose}
                    onKeepEditing={draft.handleKeepEditing}
                    onEditMemoHtml={draft.editMemoHtml}
                    onEditTableSource={draft.editTableSource}
                    onEditMermaidSource={draft.editMermaidSource}
                    onEditImageLabel={draft.editImageLabel}
                    onAddSection={draft.addSection}
                    onAddTableToSection={draft.addTableToSection}
                    onAddMermaidToSection={draft.addMermaidToSection}
                    onAddImageToSection={draft.addImageToSection}
                    onReorderSection={draft.reorderSection}
                />
            )}
        </div>
    );
}

describe("BoardMarkdownEditor 선형 편집 및 Apply 흐름", () => {
    it("편집 내용은 캔버스 프리뷰에 실시간 반영되지만 Apply 전까지 저장되지 않는다", async () => {
        const onCommitSpy = vi.fn();
        render(<Harness initial={sampleSnapshot()} onCommitSpy={onCommitSpy} />);

        const applyButton = screen.getByRole("button", { name: "Apply Markdown changes" });
        expect(applyButton).toBeDisabled();

        // 메모 편집 → 프리뷰 즉시 반영, committed는 미변경
        fireEvent.click(screen.getByRole("button", { name: "Edit section 1" }));
        fireEvent.change(screen.getByLabelText("Mock memo editor"), {
            target: { value: "<h1>Alpha Edited</h1>" },
        });

        expect(screen.getByTestId("canvas-preview-first-memo")).toHaveTextContent("<h1>Alpha Edited</h1>");
        expect(screen.getByTestId("committed-first-memo")).toHaveTextContent("<h1>Alpha</h1><p>Body</p>");
        expect(onCommitSpy).not.toHaveBeenCalled();
        expect(applyButton).toBeEnabled();

        // 표 편집 + Mermaid 편집 + 섹션 추가 + 순서 변경
        fireEvent.click(screen.getByRole("button", { name: "Edit table 10" }));
        fireEvent.click(screen.getByRole("button", { name: "Mock add table row" }));

        fireEvent.click(screen.getByRole("button", { name: "Edit diagram 20" }));
        fireEvent.change(screen.getByLabelText("Mermaid source"), {
            target: { value: "flowchart TD\nC-->D" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Add section" }));
        expect(screen.getByTestId("canvas-preview-memo-count")).toHaveTextContent("3");

        fireEvent.click(screen.getByRole("button", { name: "Move section 2 up" }));

        // Apply 클릭 시 한 번에 커밋
        await act(async () => {
            fireEvent.click(applyButton);
        });

        await waitFor(() => expect(onCommitSpy).toHaveBeenCalledOnce());
        const saved = onCommitSpy.mock.calls[0][0] as BoardSnapshot;
        expect(saved.memos).toHaveLength(3);
        expect(saved.memos.every((m) => m.id > 0)).toBe(true);
        expect(saved.tables[0].source.rows).toHaveLength(2);
        expect(saved.mermaids[0].source).toBe("flowchart TD\nC-->D");
        expect(screen.getByTestId("committed-first-memo")).toHaveTextContent("<h1>Alpha Edited</h1>");
    });

    it("미적용 상태에서 닫기(X)를 누르면 확인창을 띄우고 Discard 시 프리뷰를 원복한다", () => {
        const onCommitSpy = vi.fn();
        render(<Harness initial={sampleSnapshot()} onCommitSpy={onCommitSpy} />);

        fireEvent.click(screen.getByRole("button", { name: "Edit section 1" }));
        fireEvent.change(screen.getByLabelText("Mock memo editor"), {
            target: { value: "<h1>Temporary</h1>" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Close Markdown view" }));
        expect(screen.getByRole("dialog", { name: "Apply Markdown changes?" })).toBeInTheDocument();

        // Keep Editing → 창 닫고 편집 유지
        fireEvent.click(screen.getByRole("button", { name: "Keep Editing" }));
        expect(screen.queryByRole("dialog", { name: "Apply Markdown changes?" })).toBeNull();
        expect(screen.getByLabelText("Compiled Markdown document")).toBeInTheDocument();

        // 다시 닫기 → Discard & Close → 원복 + 커밋 안 됨
        fireEvent.click(screen.getByRole("button", { name: "Close Markdown view" }));
        fireEvent.click(screen.getByRole("button", { name: "Discard & Close" }));

        expect(screen.queryByLabelText("Compiled Markdown document")).toBeNull();
        expect(onCommitSpy).not.toHaveBeenCalled();
        expect(screen.getByTestId("canvas-preview-first-memo")).toHaveTextContent("<h1>Alpha</h1><p>Body</p>");
    });

    it("미적용 상태에서 확인창의 Apply & Close를 누르면 저장 후 닫힌다", async () => {
        const onCommitSpy = vi.fn();
        render(<Harness initial={sampleSnapshot()} onCommitSpy={onCommitSpy} />);

        fireEvent.click(screen.getByRole("button", { name: "Edit section 1" }));
        fireEvent.change(screen.getByLabelText("Mock memo editor"), {
            target: { value: "<h1>Saved On Close</h1>" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Close Markdown view" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Apply & Close" }));
        });

        await waitFor(() => expect(onCommitSpy).toHaveBeenCalledOnce());
        expect(screen.queryByLabelText("Compiled Markdown document")).toBeNull();
        expect(screen.getByTestId("committed-first-memo")).toHaveTextContent("<h1>Saved On Close</h1>");
    });

    it("섹션마다 표·Mermaid를 최대 4개까지 추가할 수 있고 4개에 도달하면 추가 버튼을 비활성화한다", async () => {
        const onCommitSpy = vi.fn();
        render(<Harness initial={sampleSnapshot()} onCommitSpy={onCommitSpy} />);

        // section 1은 이미 table 10 (1개) 보유 → 3개 더 추가해 4/4 도달
        const addTableBtn = screen.getByRole("button", { name: "Add table to section 1" });
        const addMermaidBtn = screen.getByRole("button", { name: "Add diagram to section 1" });
        const addImageBtn = screen.getByRole("button", { name: "Add image to section 1" });

        expect(addTableBtn).toBeEnabled();
        fireEvent.click(addTableBtn);
        fireEvent.click(addMermaidBtn);
        fireEvent.click(addTableBtn);

        expect(addTableBtn).toBeDisabled();
        expect(addMermaidBtn).toBeDisabled();
        expect(addImageBtn).toBeDisabled();
        expect(screen.getByText("4/4")).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Apply Markdown changes" }));
        });

        await waitFor(() => expect(onCommitSpy).toHaveBeenCalledOnce());
        const saved = onCommitSpy.mock.calls[0][0] as BoardSnapshot;
        expect(saved.tables).toHaveLength(3);
        expect(saved.mermaids).toHaveLength(2);
    });

    it("이미지가 준비된 뒤에만 Apply하고 파일을 같은 변경에 반영한다", async () => {
        let finishPreparation!: (image: imageFile.PreparedImage) => void;
        const preparation = new Promise<imageFile.PreparedImage>((resolve) => {
            finishPreparation = resolve;
        });
        const prepareImage = vi.spyOn(imageFile, "prepareImageFile").mockReturnValueOnce(preparation);
        try {
            const onCommitSpy = vi.fn<(snapshot: BoardSnapshot) => void>();
            render(<Harness initial={sampleSnapshot()} onCommitSpy={onCommitSpy} />);

            fireEvent.click(screen.getByRole("button", { name: "Edit section 1" }));
            fireEvent.change(screen.getByLabelText("Mock memo editor"), { target: { value: "<p>Edited memo</p>" } });
            const apply = screen.getByRole("button", { name: "Apply Markdown changes" });
            expect(apply).toBeEnabled();

            fireEvent.click(screen.getByRole("button", { name: "Add image to section 1" }));
            const file = new File(["image"], "local.png", { type: "image/png" });
            fireEvent.change(screen.getByLabelText("Add image to section"), { target: { files: [file] } });
            expect(prepareImage).toHaveBeenCalledWith(file);
            expect(screen.getByText("Preparing image...")).toBeInTheDocument();
            expect(apply).toBeDisabled();

            await act(async () => {
                finishPreparation({
                    data: new Uint8Array([1]),
                    mimeType: "image/png",
                    label: "local.png",
                    width: 50,
                    height: 50,
                });
            });
            expect(apply).toBeEnabled();
            await act(async () => { fireEvent.click(apply); });
            expect(onCommitSpy).toHaveBeenCalledOnce();
            const [[snapshot]] = onCommitSpy.mock.calls;
            expect(snapshot.memos[0].content).toBe("<p>Edited memo</p>");
            expect(snapshot.images[0]).toMatchObject({ imageId: 1, label: "local.png" });
        } finally {
            prepareImage.mockRestore();
        }
    });

    it("Alt+Enter 또는 Cmd+Enter로 메모·표·이미지·Mermaid 순으로 다음 오브젝트 편집으로 이동한다", async () => {
        const snapshot: BoardSnapshot = {
            ...sampleSnapshot(),
            images: [
                {
                    imageId: 30,
                    syncId: "img30",
                    boardId: 1,
                    assetId: "asset-30",
                    url: "https://example.com/chart.png",
                    data: null,
                    mimeType: null,
                    label: "Chart",
                    x: 500,
                    y: 280,
                    z: 5,
                    width: 220,
                    height: 140,
                },
            ],
        };

        render(<Harness initial={snapshot} onCommitSpy={vi.fn()} />);

        // 1. Memo 1 편집 시작
        fireEvent.click(screen.getByRole("button", { name: "Edit section 1" }));
        expect(screen.getByLabelText("Mock memo editor")).toBeInTheDocument();

        // 2. Alt+Enter → Table 10 편집으로 이동
        fireEvent.keyDown(screen.getByLabelText("Mock memo editor"), { key: "Enter", altKey: true });
        expect(document.querySelector('[data-linear-table-editing="10"]')).toBeInTheDocument();

        // 3. Cmd+Enter → Image 30 캡션 편집으로 이동 및 포커스
        const tableEditor = document.querySelector('[data-linear-table-editing="10"]') as HTMLElement;
        fireEvent.keyDown(tableEditor, { key: "Enter", metaKey: true });
        const captionInput = screen.getByLabelText("Image caption 30");
        expect(document.querySelector('[data-linear-image-editing="30"]')).toBeInTheDocument();
        expect(captionInput).toHaveFocus();

        // 4. Alt+Enter → Memo 2 편집으로 이동
        fireEvent.keyDown(captionInput, { key: "Enter", altKey: true });
        expect(document.querySelector('[data-linear-memo-editing="2"]')).toBeInTheDocument();

        // 5. Cmd+Enter → Mermaid 20 편집으로 이동
        fireEvent.keyDown(screen.getByLabelText("Mock memo editor"), { key: "Enter", metaKey: true });
        expect(document.querySelector('[data-linear-mermaid-editing="20"]')).toBeInTheDocument();
        expect(screen.getByLabelText("Mermaid source")).toBeInTheDocument();

        // 6. 마지막 오브젝트에서 Alt+Enter를 눌러도 마지막 오브젝트 유지
        fireEvent.keyDown(screen.getByLabelText("Mermaid source"), { key: "Enter", altKey: true });
        expect(document.querySelector('[data-linear-mermaid-editing="20"]')).toBeInTheDocument();

        // 7. Shift+Cmd+Enter → 이전 오브젝트(Memo 2)로 복귀
        fireEvent.keyDown(screen.getByLabelText("Mermaid source"), { key: "Enter", metaKey: true, shiftKey: true });
        expect(document.querySelector('[data-linear-memo-editing="2"]')).toBeInTheDocument();
    });

    it("읽기 전용 권한에서는 편집·Apply·섹션 추가 UI를 숨기고 다운로드 버튼은 유지한다", () => {
        render(<Harness initial={sampleSnapshot()} canEdit={false} onCommitSpy={vi.fn()} />);

        expect(screen.getByText("Read-only")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Apply Markdown changes" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Add section" })).toBeNull();
        expect(screen.getByRole("button", { name: "Download Markdown" })).toBeEnabled();
    });
});
