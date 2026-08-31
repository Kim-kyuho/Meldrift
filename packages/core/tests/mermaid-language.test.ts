import { describe, expect, it } from "vitest";
import {
    collectMermaidSymbols,
    detectMermaidDiagramType,
    findMermaidDiagramType,
    getMermaidCompletions,
    getMermaidTemplate,
    mermaidDiagramDefinitions,
} from "../src/mermaid-language";

describe("Mermaid language registry", () => {
    it("keeps diagram ids and declarations unique", () => {
        const ids = mermaidDiagramDefinitions.map((diagram) => diagram.id);
        const declarations = mermaidDiagramDefinitions.flatMap((diagram) => diagram.declarations.map((item) => item.toLowerCase()));

        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(declarations).size).toBe(declarations.length);
    });

    it("detects every registered template", () => {
        mermaidDiagramDefinitions.forEach((diagram) => {
            expect(findMermaidDiagramType(diagram.template)).toBe(diagram.id);
            expect(detectMermaidDiagramType(diagram.template)).toBe(diagram.id);
        });
    });

    it("falls back to flowchart for an unknown or empty source", () => {
        expect(findMermaidDiagramType("unknown")).toBeNull();
        expect(detectMermaidDiagramType("")).toBe("flowchart");
    });

    it("returns a starter template for each type", () => {
        mermaidDiagramDefinitions.forEach((diagram) => {
            expect(getMermaidTemplate(diagram.id)).toBe(diagram.template);
        });
    });
});

describe("Mermaid completion engine", () => {
    it("suggests flowchart shapes after a node id", () => {
        const source = "flowchart LR\n    A";
        const result = getMermaidCompletions(source, source.length);

        expect(result?.from).toBe(source.lastIndexOf("A"));
        expect(result?.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ apply: `A["Text"]`, detail: "Rectangle" }),
            expect.objectContaining({ apply: `A("Text")`, detail: "Rounded rectangle" }),
            expect.objectContaining({ apply: `A{"Text"}`, detail: "Diamond" }),
        ]));
    });

    it("suggests every flowchart relation after a completed node", () => {
        const source = `flowchart LR\n    A["Start"]`;
        const result = getMermaidCompletions(source, source.length);

        expect(result?.options.map((option) => option.label)).toEqual([
            "-->", "---", "-.->", "-.-", "==>", "===", "--o", "--x",
        ]);
    });

    it("reuses objects already declared in the document", () => {
        const source = `flowchart LR\n    A["Start"] --> B["Finish"]\n    C["Next"] --> `;
        const result = getMermaidCompletions(source, source.length);

        expect(collectMermaidSymbols(source)).toEqual(expect.arrayContaining([
            { id: "A", label: "Start" },
            { id: "B", label: "Finish" },
            { id: "C", label: "Next" },
        ]));
        expect(result?.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: "A", kind: "symbol" }),
            expect.objectContaining({ label: "B", kind: "symbol" }),
            expect.objectContaining({ label: "C", kind: "symbol" }),
        ]));
    });

    it("suggests shapes for a new object typed after a flowchart arrow", () => {
        const source = `flowchart LR\n    A["Start"] --> NewObject`;
        const result = getMermaidCompletions(source, source.length);

        expect(result?.from).toBe(source.lastIndexOf("NewObject"));
        expect(result?.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ apply: `NewObject["Text"]`, detail: "Rectangle" }),
            expect.objectContaining({ apply: `NewObject("Text")`, detail: "Rounded rectangle" }),
            expect.objectContaining({ apply: `NewObject{"Text"}`, detail: "Diamond" }),
        ]));
    });

    it("suggests diagram-specific keywords", () => {
        const source = "sequenceDiagram\n    part";
        const result = getMermaidCompletions(source, source.length);

        expect(result?.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: "participant", kind: "keyword" }),
            expect.objectContaining({ label: "actor", kind: "keyword" }),
        ]));
    });

    it("suggests existing sequence participants after a message arrow", () => {
        const source = `sequenceDiagram\n    participant A as User\n    participant B as System\n    A->>`;
        const result = getMermaidCompletions(source, source.length);

        expect(result?.options).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: "A", detail: "User" }),
            expect.objectContaining({ label: "B", detail: "System" }),
        ]));
    });
});
