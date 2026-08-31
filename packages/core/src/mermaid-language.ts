export type MermaidDiagramDefinition = {
    id: string;
    label: string;
    declarations: readonly string[];
    template: string;
    keywords: readonly string[];
};

const definition = <T extends MermaidDiagramDefinition>(value: T) => value;

export const mermaidDiagramDefinitions = [
    definition({
        id: "flowchart",
        label: "Flowchart",
        declarations: ["flowchart", "graph"],
        template: `flowchart LR\n    A["Start"] --> B["End"]`,
        keywords: ["subgraph", "end", "direction", "classDef", "class", "style", "linkStyle", "click"],
    }),
    definition({
        id: "swimlanes",
        label: "Swimlanes",
        declarations: ["swimlane-beta"],
        template: `swimlane-beta LR\n    subgraph Team\n      A["Start"]\n      B["End"]\n    end\n    A --> B`,
        keywords: ["subgraph", "end", "direction", "classDef", "class", "style"],
    }),
    definition({
        id: "sequence",
        label: "Sequence",
        declarations: ["sequenceDiagram"],
        template: `sequenceDiagram\n    participant A as User\n    participant B as System\n    A->>B: Request`,
        keywords: ["participant", "actor", "create", "destroy", "autonumber", "Note", "loop", "alt", "else", "opt", "par", "and", "critical", "option", "break", "rect", "end"],
    }),
    definition({
        id: "class",
        label: "Class",
        declarations: ["classDiagram"],
        template: `classDiagram\n    class ClassA\n    class ClassB\n    ClassA --> ClassB`,
        keywords: ["class", "namespace", "direction", "note", "click", "callback", "link"],
    }),
    definition({
        id: "state",
        label: "State",
        declarations: ["stateDiagram-v2", "stateDiagram"],
        template: `stateDiagram-v2\n    [*] --> State1\n    State1 --> [*]`,
        keywords: ["state", "direction", "note", "fork", "join", "choice", "concurrency"],
    }),
    definition({
        id: "er",
        label: "Entity Relationship",
        declarations: ["erDiagram"],
        template: `erDiagram\n    CUSTOMER ||--o{ ORDER : places`,
        keywords: ["direction", "string", "int", "float", "boolean", "date", "PK", "FK", "UK"],
    }),
    definition({
        id: "journey",
        label: "User Journey",
        declarations: ["journey"],
        template: `journey\n    title User journey\n    section Start\n      Open application: 5: User`,
        keywords: ["title", "section"],
    }),
    definition({
        id: "gantt",
        label: "Gantt",
        declarations: ["gantt"],
        template: `gantt\n    title Project\n    dateFormat YYYY-MM-DD\n    section Plan\n      Task: 2026-01-01, 1d`,
        keywords: ["title", "dateFormat", "axisFormat", "tickInterval", "excludes", "includes", "todayMarker", "section", "done", "active", "crit", "milestone"],
    }),
    definition({
        id: "pie",
        label: "Pie",
        declarations: ["pie"],
        template: `pie showData\n    title Distribution\n    "Item" : 100`,
        keywords: ["showData", "title"],
    }),
    definition({
        id: "quadrant",
        label: "Quadrant",
        declarations: ["quadrantChart"],
        template: `quadrantChart\n    title Priority\n    x-axis Low --> High\n    y-axis Low --> High\n    Item: [0.5, 0.5]`,
        keywords: ["title", "x-axis", "y-axis", "quadrant-1", "quadrant-2", "quadrant-3", "quadrant-4", "classDef"],
    }),
    definition({
        id: "requirement",
        label: "Requirement",
        declarations: ["requirementDiagram"],
        template: `requirementDiagram\n    requirement requirement1 {\n      id: 1\n      text: Requirement\n      risk: low\n      verifymethod: test\n    }`,
        keywords: ["requirement", "functionalRequirement", "interfaceRequirement", "performanceRequirement", "physicalRequirement", "designConstraint", "element", "contains", "copies", "derives", "satisfies", "verifies", "refines", "traces"],
    }),
    definition({
        id: "git",
        label: "Git Graph",
        declarations: ["gitGraph"],
        template: `gitGraph\n    commit\n    branch feature\n    checkout feature\n    commit`,
        keywords: ["commit", "branch", "checkout", "switch", "merge", "cherry-pick", "reset", "tag", "type", "id"],
    }),
    definition({
        id: "c4",
        label: "C4",
        declarations: ["C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment"],
        template: `C4Context\n    Person(user, "User")\n    System(system, "System")\n    Rel(user, system, "Uses")`,
        keywords: ["title", "Person", "Person_Ext", "System", "System_Ext", "SystemDb", "Container", "Component", "Rel", "BiRel", "Rel_U", "Rel_D", "Rel_L", "Rel_R", "UpdateLayoutConfig"],
    }),
    definition({
        id: "mindmap",
        label: "Mindmap",
        declarations: ["mindmap"],
        template: `mindmap\n  root((Mindmap))\n    Topic\n      Detail`,
        keywords: ["root", "icon", "class"],
    }),
    definition({
        id: "timeline",
        label: "Timeline",
        declarations: ["timeline"],
        template: `timeline\n    title Timeline\n    2026 : Event`,
        keywords: ["title", "section"],
    }),
    definition({
        id: "zenuml",
        label: "ZenUML",
        declarations: ["zenuml"],
        template: `zenuml\n    @Actor User\n    User -> System: Request`,
        keywords: ["@Actor", "@Boundary", "@Control", "@Database", "@Entity", "@Starter", "@AzureFunction", "if", "else", "while", "for", "try", "catch", "finally", "opt", "par"],
    }),
    definition({
        id: "sankey",
        label: "Sankey",
        declarations: ["sankey-beta", "sankey"],
        template: `sankey-beta\n    Source,Target,1`,
        keywords: [],
    }),
    definition({
        id: "xychart",
        label: "XY Chart",
        declarations: ["xychart-beta", "xychart"],
        template: `xychart-beta\n    title "Chart"\n    x-axis [1, 2, 3]\n    y-axis "Value" 0 --> 10\n    line [2, 5, 8]`,
        keywords: ["title", "x-axis", "y-axis", "line", "bar"],
    }),
    definition({
        id: "block",
        label: "Block",
        declarations: ["block-beta", "block"],
        template: `block-beta\n    columns 1\n    A["Block"]`,
        keywords: ["columns", "block", "space", "classDef", "class", "style"],
    }),
    definition({
        id: "packet",
        label: "Packet",
        declarations: ["packet-beta", "packet"],
        template: `packet-beta\n    0-7: "Header"\n    8-15: "Payload"`,
        keywords: ["title"],
    }),
    definition({
        id: "kanban",
        label: "Kanban",
        declarations: ["kanban"],
        template: `kanban\n    todo[Todo]\n      task1[Task]`,
        keywords: ["icon", "assigned", "ticket", "priority"],
    }),
    definition({
        id: "architecture",
        label: "Architecture",
        declarations: ["architecture-beta", "architecture"],
        template: `architecture-beta\n    group api(cloud)[API]\n    service server(server)[Server] in api`,
        keywords: ["group", "service", "junction", "in", "at", "icon"],
    }),
    definition({
        id: "radar",
        label: "Radar",
        declarations: ["radar-beta"],
        template: `radar-beta\n    title Skills\n    axis coding["Coding"], design["Design"]\n    curve user["User"]{8, 6}`,
        keywords: ["title", "axis", "curve", "showLegend", "max", "min", "ticks"],
    }),
    definition({
        id: "eventmodeling",
        label: "Event Modeling",
        declarations: ["eventmodeling"],
        template: `eventmodeling\n    tf 01 ui Interface\n    tf 02 cmd Command\n    tf 03 evt Event`,
        keywords: ["tf", "timeframe", "rf", "resetframe", "ui", "pcr", "processor", "cmd", "command", "rmo", "readmodel", "evt", "event", "data"],
    }),
    definition({
        id: "treemap",
        label: "Treemap",
        declarations: ["treemap"],
        template: `treemap\n    "Root"\n      "Child": 1`,
        keywords: ["title"],
    }),
    definition({
        id: "venn",
        label: "Venn",
        declarations: ["venn-beta"],
        template: `venn-beta\n    title "Sets"\n    set A["A"]\n    set B["B"]\n    union A,B["A and B"]`,
        keywords: ["title", "set", "union"],
    }),
    definition({
        id: "ishikawa",
        label: "Ishikawa",
        declarations: ["ishikawa-beta", "ishikawa"],
        template: `ishikawa-beta\n    Problem\n    Cause\n      Detail`,
        keywords: [],
    }),
    definition({
        id: "wardley",
        label: "Wardley",
        declarations: ["wardley-beta"],
        template: `wardley-beta\n    title Wardley Map\n    anchor User [0.95, 0.63]\n    component Need [0.90, 0.70]\n    User -> Need`,
        keywords: ["title", "anchor", "component", "evolve", "pipeline", "note", "market", "build", "buy", "outsource", "inertia"],
    }),
    definition({
        id: "cynefin",
        label: "Cynefin",
        declarations: ["cynefin-beta"],
        template: `cynefin-beta\n    title Cynefin\n    complex\n      "Investigate"\n    clear\n      "Known procedure"`,
        keywords: ["title", "complex", "complicated", "clear", "chaotic", "confusion"],
    }),
    definition({
        id: "treeView",
        label: "Tree View",
        declarations: ["treeView-beta"],
        template: `treeView-beta\n    └── root\n        └── child`,
        keywords: ["icon"],
    }),
    definition({
        id: "railroad",
        label: "Railroad",
        declarations: ["railroad-beta"],
        template: "railroad-beta",
        keywords: [],
    }),
    definition({
        id: "railroadEbnf",
        label: "Railroad EBNF",
        declarations: ["railroad-ebnf-beta"],
        template: "railroad-ebnf-beta",
        keywords: [],
    }),
    definition({
        id: "railroadAbnf",
        label: "Railroad ABNF",
        declarations: ["railroad-abnf-beta"],
        template: "railroad-abnf-beta",
        keywords: [],
    }),
    definition({
        id: "railroadPeg",
        label: "Railroad PEG",
        declarations: ["railroad-peg-beta"],
        template: "railroad-peg-beta",
        keywords: [],
    }),
] as const;

export type MermaidDiagramType = (typeof mermaidDiagramDefinitions)[number]["id"];

export type MermaidSymbol = {
    id: string;
    label: string;
};

export type MermaidCompletion = {
    label: string;
    apply: string;
    detail: string;
    kind: "keyword" | "node" | "relation" | "symbol" | "snippet";
};

export type MermaidCompletionResult = {
    from: number;
    options: MermaidCompletion[];
};

const flowchartShapes = [
    { label: "Rectangle", suffix: `["Text"]` },
    { label: "Rounded rectangle", suffix: `("Text")` },
    { label: "Stadium", suffix: `(["Text"])` },
    { label: "Subroutine", suffix: `[["Text"]]` },
    { label: "Cylinder", suffix: `[("Text")]` },
    { label: "Circle", suffix: `(("Text"))` },
    { label: "Double circle", suffix: `((("Text")))` },
    { label: "Asymmetric", suffix: `>"Text"]` },
    { label: "Diamond", suffix: `{"Text"}` },
    { label: "Hexagon", suffix: `{{"Text"}}` },
    { label: "Parallelogram", suffix: `[/"Text"/]` },
    { label: "Parallelogram alt", suffix: `[\\"Text"\\]` },
    { label: "Trapezoid", suffix: `[/"Text"\\]` },
    { label: "Trapezoid alt", suffix: `[\\"Text"/]` },
] as const;

const relationOptions: Partial<Record<MermaidDiagramType, readonly MermaidCompletion[]>> = {
    flowchart: [
        { label: "-->", apply: " --> ", detail: "Arrow", kind: "relation" },
        { label: "---", apply: " --- ", detail: "Open link", kind: "relation" },
        { label: "-.->", apply: " -.-> ", detail: "Dotted arrow", kind: "relation" },
        { label: "-.-", apply: " -.- ", detail: "Dotted link", kind: "relation" },
        { label: "==>", apply: " ==> ", detail: "Thick arrow", kind: "relation" },
        { label: "===", apply: " === ", detail: "Thick link", kind: "relation" },
        { label: "--o", apply: " --o ", detail: "Circle edge", kind: "relation" },
        { label: "--x", apply: " --x ", detail: "Cross edge", kind: "relation" },
    ],
    sequence: [
        { label: "->>", apply: "->> ", detail: "Solid message", kind: "relation" },
        { label: "-->>", apply: "-->> ", detail: "Dotted message", kind: "relation" },
        { label: "->", apply: "-> ", detail: "Solid line", kind: "relation" },
        { label: "-->", apply: "--> ", detail: "Dotted line", kind: "relation" },
        { label: "-x", apply: "-x ", detail: "Lost message", kind: "relation" },
        { label: "-)" , apply: "-) ", detail: "Async message", kind: "relation" },
    ],
    class: ["<|--", "*--", "o--", "-->", "--", "..>", "..|>", ".."].map((relation) => ({
        label: relation,
        apply: `${relation} `,
        detail: "Class relation",
        kind: "relation" as const,
    })),
    state: [
        { label: "-->", apply: "--> ", detail: "Transition", kind: "relation" },
    ],
    er: ["||--||", "||--o|", "||--o{", "}|--|{", "}o--o{", "}|..|{", "||..o{"].map((relation) => ({
        label: relation,
        apply: `${relation} `,
        detail: "ER cardinality",
        kind: "relation" as const,
    })),
};

const declarationLine = (source: string) => {
    const lines = source.split(/\r?\n/);
    let insideFrontmatter = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("%%")) continue;

        if (line === "---") {
            insideFrontmatter = !insideFrontmatter;
            continue;
        }

        if (!insideFrontmatter) return line;
    }

    return "";
};

export const getMermaidDiagramDefinition = (type: MermaidDiagramType) =>
    mermaidDiagramDefinitions.find((item) => item.id === type) ?? mermaidDiagramDefinitions[0];

export const findMermaidDiagramType = (source: string): MermaidDiagramType | null => {
    const firstLine = declarationLine(source).toLowerCase();
    const match = mermaidDiagramDefinitions.find((item) =>
        item.declarations.some((declaration) => {
            const normalized = declaration.toLowerCase();
            return firstLine === normalized || firstLine.startsWith(`${normalized} `);
        })
    );

    return match?.id ?? null;
};

export const detectMermaidDiagramType = (source: string): MermaidDiagramType =>
    findMermaidDiagramType(source) ?? "flowchart";

export const getMermaidTemplate = (type: MermaidDiagramType) =>
    getMermaidDiagramDefinition(type).template;

const handDrawnDirective = `%%{init: {"look": "handDrawn"}}%%`;
const handDrawnPattern = /^[ \t]*%%\{\s*init\s*:\s*\{\s*"look"\s*:\s*"handDrawn"\s*\}\s*\}%%[ \t]*\r?\n?/m;
const frontmatterPattern = /^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/;

export const hasMermaidHandDrawnLook = (source: string) => handDrawnPattern.test(source);

export const toggleMermaidHandDrawnLook = (source: string) => {
    if (hasMermaidHandDrawnLook(source)) {
        return source.replace(handDrawnPattern, "");
    }

    // 프론트매터는 반드시 맨 앞이어야 하므로 있으면 그 뒤에 지시자를 넣는다.
    const frontmatter = source.match(frontmatterPattern);
    if (!frontmatter) {
        return `${handDrawnDirective}\n${source}`;
    }

    return `${frontmatter[0]}${handDrawnDirective}\n${source.slice(frontmatter[0].length)}`;
};

const collectFlowchartSymbols = (source: string): MermaidSymbol[] => {
    const symbols = new Map<string, MermaidSymbol>();
    const nodePattern = /\b([A-Za-z_][\w-]*)\s*(\[\[|\[\(|\[\/|\[\\|\[|\(\(\(|\(\(|\(|\{\{|\{|>)([^\n;]*?)(?:\]\]|\)\]|\/\]|\\\]|\]|\)\)\)|\)\)|\)|\}\}|\}|\])/g;

    for (const match of source.matchAll(nodePattern)) {
        const id = match[1];
        const label = match[3].replace(/^\s*["']|["']\s*$/g, "").trim() || id;
        symbols.set(id, { id, label });
    }

    const edgePattern = /\b([A-Za-z_][\w-]*)\s*(?:-->|---|-\.->|-\.-|==>|===|--o|--x)\s*([A-Za-z_][\w-]*)/g;
    for (const match of source.matchAll(edgePattern)) {
        [match[1], match[2]].forEach((id) => {
            if (!symbols.has(id)) symbols.set(id, { id, label: id });
        });
    }

    return [...symbols.values()];
};

const collectNamedSymbols = (source: string, type: MermaidDiagramType): MermaidSymbol[] => {
    if (type === "flowchart") return collectFlowchartSymbols(source);

    const symbols = new Map<string, MermaidSymbol>();
    const patterns: Partial<Record<MermaidDiagramType, readonly RegExp[]>> = {
        sequence: [/^\s*(?:participant|actor)\s+([\w-]+)(?:\s+as\s+(.+))?/gim],
        class: [/^\s*class\s+([\w-]+)/gim],
        state: [/^\s*state\s+"?([^"\n]+)"?\s+as\s+([\w-]+)/gim, /^\s*([\w-]+)\s*-->/gim],
        er: [/^\s*([A-Za-z_][\w-]*)\s+[|}o{]/gim, /^\s*([A-Za-z_][\w-]*)\s*\{/gim],
        venn: [/^\s*set\s+([\w-]+)(?:\["?([^\]"]+)"?\])?/gim],
        architecture: [/^\s*(?:group|service|junction)\s+([\w-]+)/gim],
        requirement: [/^\s*(?:requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+([\w-]+)/gim],
    };

    for (const pattern of patterns[type] ?? []) {
        for (const match of source.matchAll(pattern)) {
            const id = type === "state" && match[2] ? match[2] : match[1];
            const label = type === "state" && match[2] ? match[1] : match[2] ?? id;
            symbols.set(id, { id, label: label.trim() });
        }
    }

    return [...symbols.values()];
};

export const collectMermaidSymbols = (source: string, type = detectMermaidDiagramType(source)) =>
    collectNamedSymbols(source, type);

const currentWordRange = (source: string, cursor: number) => {
    const beforeCursor = source.slice(0, cursor);
    const word = beforeCursor.match(/[A-Za-z_@][\w@-]*$/)?.[0] ?? "";
    return { from: cursor - word.length, word };
};

const symbolCompletions = (symbols: MermaidSymbol[]): MermaidCompletion[] =>
    symbols.map((symbol) => ({
        label: symbol.id,
        apply: symbol.id,
        detail: symbol.label === symbol.id ? "Existing object" : symbol.label,
        kind: "symbol",
    }));

const flowchartShapeCompletions = (id: string): MermaidCompletion[] =>
    flowchartShapes.map((shape) => ({
        label: `${id}${shape.suffix}`,
        apply: `${id}${shape.suffix}`,
        detail: shape.label,
        kind: "node",
    }));

export const getMermaidCompletions = (
    source: string,
    cursor: number,
    fallbackType?: MermaidDiagramType,
): MermaidCompletionResult | null => {
    const safeCursor = Math.max(0, Math.min(cursor, source.length));
    const type = source.trim() ? detectMermaidDiagramType(source) : fallbackType ?? "flowchart";
    const definitionItem = getMermaidDiagramDefinition(type);
    const beforeCursor = source.slice(0, safeCursor);
    const lineStart = beforeCursor.lastIndexOf("\n") + 1;
    const line = beforeCursor.slice(lineStart);
    const symbols = collectNamedSymbols(source, type);

    if (type === "flowchart") {
        const nodeIdMatch = line.match(/^(\s*)([A-Za-z_][\w-]*)$/);
        if (nodeIdMatch) {
            const id = nodeIdMatch[2];
            const from = lineStart + nodeIdMatch[1].length;
            return {
                from,
                options: [
                    ...flowchartShapeCompletions(id),
                    ...symbolCompletions(symbols),
                ],
            };
        }

        if (/(?:-->|---|-\.->|-\.-|==>|===|--o|--x)\s*[A-Za-z_\w-]*$/.test(line)) {
            const { from, word } = currentWordRange(source, safeCursor);
            return {
                from,
                options: [
                    ...(word ? flowchartShapeCompletions(word) : []),
                    ...symbolCompletions(symbols),
                    { label: "New node", apply: `Node["Text"]`, detail: "Create object", kind: "node" },
                ],
            };
        }

        if (/(?:\]\]|\)\]|\/\]|\\\]|\]|\)\)\)|\)\)|\)|\}\}|\})\s*$/.test(line)) {
            return {
                from: safeCursor,
                options: [...(relationOptions.flowchart ?? [])],
            };
        }
    }

    const relationList = relationOptions[type];
    if (relationList && /(?:^|\s)[A-Za-z_][\w-]*\s+$/.test(line)) {
        return { from: safeCursor, options: [...relationList] };
    }

    if (relationList && relationList.some((relation) => line.includes(relation.label))) {
        const { from } = currentWordRange(source, safeCursor);
        return { from, options: symbolCompletions(symbols) };
    }

    const { from, word } = currentWordRange(source, safeCursor);
    if (!word) return null;

    const keywordOptions: MermaidCompletion[] = definitionItem.keywords.map((keyword) => ({
        label: keyword,
        apply: keyword,
        detail: definitionItem.label,
        kind: "keyword",
    }));

    return {
        from,
        options: [...keywordOptions, ...symbolCompletions(symbols)],
    };
};
