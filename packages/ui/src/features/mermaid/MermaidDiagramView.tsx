"use client";

import { useEffect, useRef } from "react";
import { createDiagramRenderer, type DiagramRenderer } from "@meldrift/diagram-engine";
import { fitReadOnlyDiagram } from "./mermaid-layout";

type MermaidDiagramViewProps = {
    source: string;
    className?: string;
};

/** 편집 없이 그림만 보여 준다. 저장된 노드 위치는 그대로 적용된다. */
export default function MermaidDiagramView({ source, className }: MermaidDiagramViewProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<DiagramRenderer | null>(null);
    // 렌더러는 한 번만 만들므로 첫 소스만 여기서 읽고, 이후 반영은 아래 동기화 이펙트가 맡는다.
    const initialSourceRef = useRef(source);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const renderer = createDiagramRenderer(container, {
            source: initialSourceRef.current,
            palette: false,
            draggable: false,
            editable: false,
        });
        rendererRef.current = renderer;
        const observer = new MutationObserver(() => fitReadOnlyDiagram(container));
        const canvas = renderer.element.querySelector(".meldrift-diagram-canvas");
        if (canvas) {
            observer.observe(canvas, { childList: true });
        }

        return () => {
            observer.disconnect();
            renderer.destroy();
            rendererRef.current = null;
        };
    }, []);

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer || renderer.getSource() === source) {
            return;
        }

        void renderer.setSource(source).then(() => {
            if (rendererRef.current === renderer) {
                fitReadOnlyDiagram(renderer.element);
            }
        });
    }, [source]);

    return <div ref={containerRef} className={className} />;
}
