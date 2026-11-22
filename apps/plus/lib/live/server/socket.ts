import type { WebSocket } from "ws";

// 운영(upgradeWebSocket)과 개발용 서버(ws.WebSocketServer)가 같은 ws 소켓을 준다. 테스트는 가짜를 넣는다.
export type LiveSocket = {
    send: (data: string) => void;
    close: (code: number, reason?: string) => void;
    onMessage: (listener: (data: string) => void) => void;
    onClose: (listener: () => void) => void;
};

export function fromWebSocket(socket: WebSocket): LiveSocket {
    return {
        send: (data) => {
            if (socket.readyState === socket.OPEN) {
                socket.send(data);
            }
        },
        close: (code, reason) => {
            if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING) {
                socket.close(code, reason);
            }
        },
        onMessage: (listener) => {
            socket.on("message", (data, isBinary) => {
                if (isBinary) {
                    socket.close(1003, "Binary frames are not supported.");
                    return;
                }
                listener(data.toString());
            });
        },
        onClose: (listener) => {
            socket.on("close", listener);
            socket.on("error", () => socket.terminate());
        },
    };
}
