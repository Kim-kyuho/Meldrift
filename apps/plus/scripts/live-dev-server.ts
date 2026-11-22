// 로컬 개발용 Live 서버. next dev는 WebSocket 업그레이드를 처리하지 못하므로 별도 포트에서 같은 허브 코드를 띄운다.
// 운영에서는 app/api/boards/[boardId]/live/route.ts가 upgradeWebSocket으로 같은 일을 한다.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnvConfig } from "@next/env";
import { WebSocketServer } from "ws";
import { liveLimits } from "../lib/live/protocol";
import { getLiveStore, liveBridgeSecret } from "../lib/live/store";
import { bridgeMethods } from "../lib/live/store/bridge-store";
import { getLiveHub } from "../lib/live/server/hub";
import { resolveLiveIdentity } from "../lib/live/server/identity";
import { liveOriginAllowed } from "../lib/live/server/origin";
import { fromWebSocket } from "../lib/live/server/socket";
import { verifyLiveToken } from "../lib/live/token";

// 모듈들은 호출 시점에 환경 변수를 읽으므로, 저장소를 만들기 전에만 설정하면 된다.
loadEnvConfig(process.cwd(), true);
process.env.LIVE_DEV_SERVER = "true";
process.env.LIVE_ENABLED = "true";

const store = getLiveStore();
if (!store) {
    throw new Error("The live development store could not be created.");
}
const hub = getLiveHub(store);
const port = Number(process.env.LIVE_DEV_PORT ?? 3002);
const livePath = /^(?:\/plus)?\/api\/boards\/(\d+)\/live$/;

async function readBody(request: IncomingMessage) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        size += (chunk as Buffer).length;
        if (size > 2 * 1024 * 1024) {
            throw new Error("Bridge request too large.");
        }
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
}

async function handleBridge(request: IncomingMessage, response: ServerResponse) {
    if (request.headers["x-live-bridge-secret"] !== liveBridgeSecret()) {
        response.writeHead(403).end();
        return;
    }
    const { method, args } = JSON.parse(await readBody(request)) as { method: string; args: unknown[] };
    if (!(bridgeMethods as readonly string[]).includes(method)) {
        response.writeHead(400).end();
        return;
    }
    const target = store as unknown as Record<string, (...values: unknown[]) => Promise<unknown>>;
    const value = await target[method](...args);
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ value: value ?? null }));
}

const server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/__live/bridge") {
        void handleBridge(request, response).catch((error: unknown) => {
            console.error("live.bridge_failed", error);
            response.writeHead(500).end();
        });
        return;
    }
    if (request.url === "/__live/health") {
        response.writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify({ ok: true, connections: hub.connectionCount() }));
        return;
    }
    response.writeHead(404).end();
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: liveLimits.messageBytes });

function refuse(socket: NodeJS.WritableStream & { destroy: () => void }, status: number, message: string) {
    console.warn(`live.refused ${status} ${message}`);
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
}

server.on("upgrade", (request, socket, head) => {
    void (async () => {
        const url = new URL(request.url ?? "/", "http://localhost");
        const match = livePath.exec(url.pathname);
        if (!match) {
            refuse(socket, 404, "Not Found");
            return;
        }
        if (!liveOriginAllowed(request.headers.origin ?? null, request.headers.host ?? null)) {
            refuse(socket, 403, `Forbidden (origin ${request.headers.origin ?? "missing"})`);
            return;
        }
        const token = verifyLiveToken(url.searchParams.get("token"));
        if (!token || token.b !== Number(match[1])) {
            refuse(socket, 401, "Unauthorized (token missing, expired or signed with another LIVE_TOKEN_SECRET)");
            return;
        }
        const result = await resolveLiveIdentity(token);
        if (result.closeCode !== null) {
            refuse(socket, 403, `Forbidden (board access close code ${result.closeCode})`);
            return;
        }
        sockets.handleUpgrade(request, socket, head, (webSocket) => {
            hub.attach(fromWebSocket(webSocket), result.identity);
        });
    })().catch((error: unknown) => {
        console.error("live.upgrade_failed", error);
        refuse(socket, 500, "Internal Server Error");
    });
});

server.listen(port, "0.0.0.0", () => {
    console.info(`Meldrift live development server: ws://localhost:${port} (bridge: http://127.0.0.1:${port}/__live/bridge)`);
});
