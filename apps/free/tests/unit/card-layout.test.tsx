import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImageCard from "@meldrift/ui/ImageCard";
import MermaidCard from "@meldrift/ui/MermaidCard";
import TableCard from "@meldrift/ui/TableCard";

vi.mock("react-rnd", () => ({
    Rnd: ({ children, className, lockAspectRatio }: { children: ReactNode; className?: string; lockAspectRatio?: boolean | number }) => (
        <div className={className} data-lock-aspect-ratio={String(Boolean(lockAspectRatio))}>{children}</div>
    ),
}));

vi.mock("@meldrift/diagram-engine", () => ({
    createDiagramRenderer: (container: HTMLElement) => {
        const element = document.createElement("div");
        container.append(element);

        return {
            element,
            setSource: vi.fn(),
            getSource: () => "",
            setCursor: vi.fn(),
            destroy: () => element.remove(),
        };
    },
    createDiagramEditor: vi.fn(),
}));

const callback = vi.fn();

afterEach(() => vi.unstubAllGlobals());

describe("카드 표면 배치", () => {
    it("이미지 카드에 흰 배경을 강제하지 않고 종횡비를 고정한다", () => {
        const { container } = render(
            <ImageCard
                image={{
                    imageId: 1,
                    boardId: 1,
                    url: "https://example.com/image.png",
                    data: null,
                    mimeType: null,
                    label: "Example",
                    x: 0,
                    y: 0,
                    z: 1,
                    width: 180,
                    height: 180,
                }}
                zoom={1}
                isEditing={false}
                onEditing={callback}
                onEditingClear={callback}
                onUpdate={callback}
                onDelete={callback}
                onBringToFront={callback}
                onSendToBack={callback}
            />
        );

        expect(container.querySelector(".image-rnd-1 > div")).not.toHaveClass("bg-white");
        expect(container.querySelector(".image-rnd-1")).toHaveAttribute("data-lock-aspect-ratio", "true");
    });

    it("저장된 로컬 이미지의 Blob URL을 생성하고 해제한다", async () => {
        const createObjectURL = vi.fn().mockReturnValue("blob:stored-image");
        const revokeObjectURL = vi.fn();
        const NativeURL = URL;
        class MockURL extends NativeURL {
            static createObjectURL = createObjectURL;
            static revokeObjectURL = revokeObjectURL;
        }
        vi.stubGlobal("URL", MockURL);

        const { unmount } = render(
            <ImageCard
                image={{
                    imageId: 4,
                    boardId: 1,
                    url: "",
                    data: new Uint8Array([1, 2, 3]),
                    mimeType: "image/webp",
                    label: "Stored image",
                    x: 0,
                    y: 0,
                    z: 1,
                    width: 180,
                    height: 180,
                }}
                zoom={1}
                isEditing={false}
                onEditing={callback}
                onEditingClear={callback}
                onUpdate={callback}
                onDelete={callback}
                onBringToFront={callback}
                onSendToBack={callback}
            />
        );

        await waitFor(() => expect(screen.getByAltText("Stored image")).toHaveAttribute("src", "blob:stored-image"));
        expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        unmount();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:stored-image");
    });

    it("Mermaid 카드에 흰 배경을 강제하지 않는다", () => {
        const { container } = render(
            <MermaidCard
                mermaid={{
                    id: 2,
                    boardId: 1,
                    source: "flowchart LR\nA --> B",
                    x: 0,
                    y: 0,
                    z: 1,
                    width: 180,
                    height: 180,
                }}
                zoom={1}
                isEditing={false}
                onEditing={callback}
                onEditingClear={callback}
                onInsert={callback}
                onUpdate={callback}
                onDelete={callback}
                onBringToFront={callback}
                onSendToBack={callback}
            />
        );

        expect(container.querySelector(".mermaid-rnd-2 > div")).not.toHaveClass("bg-white");
    });

    it("테이블 카드에 흰 배경을 강제하지 않는다", () => {
        const { container } = render(
            <TableCard
                table={{
                    id: 3,
                    boardId: 1,
                    source: {
                        columns: [{ id: "name", name: "Name", width: 160 }],
                        rows: [{ id: "row-1", cells: { name: "Kyu" } }],
                    },
                    x: 0,
                    y: 0,
                    z: 1,
                    width: 360,
                    height: 180,
                }}
                zoom={1}
                isEditing={false}
                onEditing={callback}
                onEditingClear={callback}
                onInsert={callback}
                onUpdate={callback}
                onDelete={callback}
                onBringToFront={callback}
                onSendToBack={callback}
            />
        );

        expect(container.querySelector(".table-rnd-3 > div")).not.toHaveClass("bg-white");
    });
});
