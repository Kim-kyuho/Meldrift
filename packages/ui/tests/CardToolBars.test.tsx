import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoToolBar from "../src/features/memo/MemoToolBar";
import ImageToolBar from "../src/features/image/ImageToolBar";
import MermaidToolBar from "../src/features/mermaid/MermaidToolBar";
import TableToolBar from "../src/features/table/TableToolBar";

describe("카드 툴바의 레이어 비활성화 지원", () => {
    let portalContainer: HTMLElement;

    beforeEach(() => {
        portalContainer = document.createElement("div");
        portalContainer.id = "card-tool-portal";
        document.body.appendChild(portalContainer);
    });

    afterEach(() => {
        portalContainer.remove();
    });
    describe("MemoToolBar 동작", () => {
        const renderMemo = (layerDisabled: boolean) => render(
            <MemoToolBar
                onChangeColor={vi.fn()}
                onHeading={vi.fn()}
                onBold={vi.fn()}
                onItalic={vi.fn()}
                onStrike={vi.fn()}
                onHorizontalRule={vi.fn()}
                onHighlight={vi.fn()}
                onCodeBlock={vi.fn()}
                onBlockQuote={vi.fn()}
                onBringToFront={vi.fn()}
                onSendToBack={vi.fn()}
                layerDisabled={layerDisabled}
                onDelete={vi.fn()}
            />
        );

        it("layerDisabled가 참이면 레이어 버튼을 비활성화한다", () => {
            renderMemo(true);
            expect(screen.getByRole("button", { name: "Bring memo to front" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Send memo to back" })).toBeDisabled();
        });

        it("layerDisabled가 거짓이면 레이어 버튼을 활성화한다", () => {
            renderMemo(false);
            expect(screen.getByRole("button", { name: "Bring memo to front" })).not.toBeDisabled();
            expect(screen.getByRole("button", { name: "Send memo to back" })).not.toBeDisabled();
        });
    });

    describe("ImageToolBar 동작", () => {
        it("layerDisabled에 따라 레이어 버튼을 비활성화하거나 활성화한다", () => {
            const { rerender } = render(
                <ImageToolBar
                    onBringToFront={vi.fn()}
                    onSendToBack={vi.fn()}
                    layerDisabled={true}
                    onDelete={vi.fn()}
                />
            );
            expect(screen.getByRole("button", { name: "Bring image to front" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Send image to back" })).toBeDisabled();

            rerender(
                <ImageToolBar
                    onBringToFront={vi.fn()}
                    onSendToBack={vi.fn()}
                    layerDisabled={false}
                    onDelete={vi.fn()}
                />
            );
            expect(screen.getByRole("button", { name: "Bring image to front" })).not.toBeDisabled();
            expect(screen.getByRole("button", { name: "Send image to back" })).not.toBeDisabled();
        });
    });

    describe("MermaidToolBar 동작", () => {
        it("layerDisabled에 따라 레이어 버튼을 비활성화하거나 활성화한다", () => {
            const { rerender } = render(
                <MermaidToolBar
                    onBringToFront={vi.fn()}
                    onSendToBack={vi.fn()}
                    layerDisabled={true}
                    onDelete={vi.fn()}
                />
            );
            expect(screen.getByRole("button", { name: "Bring Mermaid to front" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Send Mermaid to back" })).toBeDisabled();

            rerender(
                <MermaidToolBar
                    onBringToFront={vi.fn()}
                    onSendToBack={vi.fn()}
                    layerDisabled={false}
                    onDelete={vi.fn()}
                />
            );
            expect(screen.getByRole("button", { name: "Bring Mermaid to front" })).not.toBeDisabled();
            expect(screen.getByRole("button", { name: "Send Mermaid to back" })).not.toBeDisabled();
        });
    });

    describe("TableToolBar 동작", () => {
        it("layerDisabled에 따라 레이어 버튼을 비활성화하거나 활성화한다", () => {
            const { rerender } = render(
                <TableToolBar
                    onBringToFront={vi.fn()}
                    onSendToBack={vi.fn()}
                    layerDisabled={true}
                    onDelete={vi.fn()}
                />
            );
            expect(screen.getByRole("button", { name: "Bring table to front" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Send table to back" })).toBeDisabled();

            rerender(
                <TableToolBar
                    onBringToFront={vi.fn()}
                    onSendToBack={vi.fn()}
                    layerDisabled={false}
                    onDelete={vi.fn()}
                />
            );
            expect(screen.getByRole("button", { name: "Bring table to front" })).not.toBeDisabled();
            expect(screen.getByRole("button", { name: "Send table to back" })).not.toBeDisabled();
        });
    });
});
