import { createHash } from "node:crypto";
import type { ChangeRequest } from "@meldrift/board-data/change-request";

export * from "@meldrift/board-data/change-request";

// Live 클라이언트는 재시도 사이에 다른 사람의 변경을 반영해 baseRevision이 달라질 수 있다.
// 같은 mutationId의 같은 연산은 같은 요청이므로 digest에서 판 번호를 뺀다.
export function changeRequestDigest(request: ChangeRequest) {
    return createHash("sha256")
        .update(JSON.stringify(["operations", request.operations]))
        .digest("hex");
}

// 이 배포 전에 기록된 digest는 판 번호를 포함한다. 응답을 놓친 옛 요청의 재전송을 충돌로 오판하지 않는다.
export function legacyChangeRequestDigest(request: ChangeRequest) {
    return createHash("sha256")
        .update(JSON.stringify([request.baseRevision, request.operations]))
        .digest("hex");
}
