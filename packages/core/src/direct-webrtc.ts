const defaultStunUrls = "stun:stun.l.google.com:19302";

export const directDescriptionLimit = 32 * 1024;

export function isDirectDataDescription(sdp: string) {
    const media = sdp.split(/\r?\n/).filter((line) => line.startsWith("m="));
    return sdp.length <= directDescriptionLimit && media.length === 1
        && media[0].startsWith("m=application ") && !/^a=candidate:.*\btyp relay\b/im.test(sdp);
}

export function directCollaborationSupported() {
    return globalThis.isSecureContext && typeof RTCPeerConnection === "function" && Boolean(globalThis.crypto?.subtle);
}

function iceServers(configured: string | undefined): RTCIceServer[] {
    const urls = (configured ?? defaultStunUrls).split(",")
        .map((url) => url.trim()).filter((url) => /^stuns?:[^\s]+$/.test(url));
    return urls.length ? [{ urls }] : [];
}

function gatherCandidates(connection: RTCPeerConnection) {
    if (connection.iceGatheringState === "complete" || connection.signalingState === "closed") {
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        const finish = () => {
            clearTimeout(timer);
            connection.removeEventListener("icegatheringstatechange", check);
            connection.removeEventListener("signalingstatechange", check);
            resolve();
        };
        const check = () => {
            if (connection.iceGatheringState === "complete" || connection.signalingState === "closed") {
                finish();
            }
        };
        const timer = setTimeout(finish, 4_000);
        connection.addEventListener("icegatheringstatechange", check);
        connection.addEventListener("signalingstatechange", check);
    });
}

function directDescription(sdp: string | undefined) {
    if (!sdp || !isDirectDataDescription(sdp)) {
        throw new Error("Only direct WebRTC data channels are supported.");
    }
    return sdp;
}

// ICE negotiation is shared. Each edition owns the channels and messages it sends.
export class DirectWebRtc {
    readonly connection: RTCPeerConnection;

    constructor(stunUrls: string | undefined) {
        this.connection = new RTCPeerConnection({ iceServers: iceServers(stunUrls) });
    }

    async offer() {
        await this.connection.setLocalDescription(await this.connection.createOffer());
        return this.localDescription();
    }

    async answer(sdp: string) {
        await this.connection.setRemoteDescription({ type: "offer", sdp: directDescription(sdp) });
        await this.connection.setLocalDescription(await this.connection.createAnswer());
        return this.localDescription();
    }

    async acceptAnswer(sdp: string) {
        await this.connection.setRemoteDescription({ type: "answer", sdp: directDescription(sdp) });
    }

    private async localDescription() {
        await gatherCandidates(this.connection);
        return directDescription(this.connection.localDescription?.sdp);
    }
}
