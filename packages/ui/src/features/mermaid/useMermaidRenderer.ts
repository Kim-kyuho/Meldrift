import { useEffect, useRef, useState } from "react";
import mermaidRenderer from "mermaid";
import zenuml from "@mermaid-js/mermaid-zenuml";

type UseMermaidRendererOptions = {
    source: string;
    mermaidId: number;
};

let mermaidRenderIndex = 0;

mermaidRenderer.initialize({
    startOnLoad: false,
    securityLevel: "strict",
});

const mermaidReady = mermaidRenderer.registerExternalDiagrams([zenuml]);

// 루트 svg 태그에만 적용한다. 루트에 없는 속성을 찾느라 안쪽 노드의 width·height를 지우면 도형과 라벨이 사라진다.
const makeMermaidSvgResponsive = (svg: string) =>
    svg.replace(/<svg\b[^>]*>/, (rootTag) =>
        rootTag
            .replace(/\swidth="[^"]*"/, "")
            .replace(/\sheight="[^"]*"/, "")
            .replace("<svg", "<svg preserveAspectRatio=\"xMidYMid meet\""),
    );
        
// zenUml의 스타일 설정이 글로벌Css를 덮어버리는 문제를 막기위한 처리
const removeZenUmlGlobalStyles = () => {
    document.querySelectorAll("style").forEach((style) => {
        const css = style.textContent ?? "";

        if (css.includes(".zenuml .sequence-diagram") && css.includes("--tw-ring-shadow")) {
            style.remove();
        }
    });
};

const renderMermaidSvg = async (renderId: string, source: string) => {
    await mermaidReady;

    try {
        const { svg } = await mermaidRenderer.render(renderId, source);

        return makeMermaidSvgResponsive(svg);
    } finally {
        removeZenUmlGlobalStyles();
    }
};

const removeMermaidRenderArtifacts = (renderId: string) => {
    document.getElementById(`d${renderId}`)?.remove();
    document.getElementById(`i${renderId}`)?.remove();

    const renderElement = document.getElementById(renderId);
    if (renderElement && !renderElement.closest(".mermaid-rendered")) {
        renderElement.remove();
    }
};

export function useMermaidRenderer({ source, mermaidId }: UseMermaidRendererOptions) {
    const [svg, setSvg] = useState("");
    const [renderError, setRenderError] = useState("");
    const renderTicketRef = useRef(0);

    useEffect(() => {
        const renderTicket = renderTicketRef.current + 1;
        renderTicketRef.current = renderTicket;

        if (!source.trim()) {
            void Promise.resolve().then(() => {
                if (renderTicketRef.current !== renderTicket) {
                    return;
                }

                setSvg("");
                setRenderError("");
            });
            return;
        }

        const renderId = `meldrift-mermaid-${Math.abs(mermaidId)}-${mermaidRenderIndex++}`;

        renderMermaidSvg(renderId, source)
            .then((svg) => {
                if (renderTicketRef.current !== renderTicket) {
                    return;
                }

                setSvg(svg);
                setRenderError("");
            })
            .catch((error) => {
                if (renderTicketRef.current !== renderTicket) {
                    return;
                }

                setSvg("");
                setRenderError(error instanceof Error ? error.message : "Mermaid syntax error.");
            })
            .finally(() => {
                removeMermaidRenderArtifacts(renderId);
            });
    }, [mermaidId, source]);

    return {
        svg,
        renderError,
    };
}
