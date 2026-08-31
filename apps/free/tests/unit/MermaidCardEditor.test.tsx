import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mermaidDiagramDefinitions } from "@meldrift/core/mermaid-language";

const mermaidMock = vi.hoisted(() => ({
    initialize: vi.fn(),
    registerExternalDiagrams: vi.fn().mockResolvedValue(undefined),
    render: vi.fn().mockResolvedValue({ svg: "<svg></svg>" }),
}));

vi.mock("mermaid", () => ({ default: mermaidMock }));
vi.mock("@mermaid-js/mermaid-zenuml", () => ({ default: { id: "zenuml" } }));

import MermaidCard from "@meldrift/ui/MermaidCard";

const callback = vi.fn();

const renderEditingCard = () =>
    render(
        <MermaidCard
            mermaid={{
                id: 1,
                boardId: 1,
                source: `flowchart LR\n    A["Start"] --> B["End"]`,
                x: 0,
                y: 0,
                z: 1,
                width: 480,
                height: 360,
            }}
            zoom={1}
            isEditing
            onEditing={callback}
            onEditingClear={callback}
            onInsert={callback}
            onUpdate={callback}
            onDelete={callback}
            onBringToFront={callback}
            onSendToBack={callback}
        />
    );

describe("MermaidCard editor", () => {
    beforeEach(() => {
        mermaidMock.render.mockClear();
    });

    it("provides every registered diagram type and loads its template", async () => {
        renderEditingCard();

        const typeSelect = screen.getByRole("combobox", { name: "Mermaid diagram type" });
        expect(typeSelect.querySelectorAll("option")).toHaveLength(mermaidDiagramDefinitions.length);

        fireEvent.change(typeSelect, { target: { value: "sequence" } });

        await waitFor(() => {
            expect(screen.getByLabelText("Mermaid source")).toHaveTextContent("sequenceDiagram");
            expect(mermaidMock.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining("sequenceDiagram"),
            );
        });
    });

    it("writes the hand drawn look into the source and takes it back out", async () => {
        renderEditingCard();

        const handDrawnToggle = screen.getByRole("button", { name: "Hand drawn look" });
        expect(handDrawnToggle).toHaveAttribute("aria-pressed", "false");

        fireEvent.click(handDrawnToggle);
        await waitFor(() => {
            expect(screen.getByLabelText("Mermaid source")).toHaveTextContent('%%{init: {"look": "handDrawn"}}%%');
            expect(mermaidMock.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining("handDrawn"),
            );
        });
        expect(screen.getByRole("button", { name: "Hand drawn look" })).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", { name: "Hand drawn look" }));
        await waitFor(() => {
            expect(screen.getByLabelText("Mermaid source")).not.toHaveTextContent("handDrawn");
        });
    });
});
