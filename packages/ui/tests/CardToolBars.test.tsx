import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoToolBar from "../src/features/memo/MemoToolBar";
import ImageToolBar from "../src/features/image/ImageToolBar";
import MermaidToolBar from "../src/features/mermaid/MermaidToolBar";
import TableToolBar from "../src/features/table/TableToolBar";

describe("Card toolbars layerDisabled support", () => {
    let portalContainer: HTMLElement;

    beforeEach(() => {
        portalContainer = document.createElement("div");
        portalContainer.id = "card-tool-portal";
        document.body.appendChild(portalContainer);
    });

    afterEach(() => {
        portalContainer.remove();
    });
    describe("MemoToolBar", () => {
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

        it("disables layer buttons when layerDisabled is true", () => {
            renderMemo(true);
            expect(screen.getByRole("button", { name: "Bring memo to front" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Send memo to back" })).toBeDisabled();
        });

        it("enables layer buttons when layerDisabled is false", () => {
            renderMemo(false);
            expect(screen.getByRole("button", { name: "Bring memo to front" })).not.toBeDisabled();
            expect(screen.getByRole("button", { name: "Send memo to back" })).not.toBeDisabled();
        });
    });

    describe("ImageToolBar", () => {
        it("disables and enables layer buttons based on layerDisabled", () => {
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

    describe("MermaidToolBar", () => {
        it("disables and enables layer buttons based on layerDisabled", () => {
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

    describe("TableToolBar", () => {
        it("disables and enables layer buttons based on layerDisabled", () => {
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
