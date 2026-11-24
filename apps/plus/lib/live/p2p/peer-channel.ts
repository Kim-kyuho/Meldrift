import { DirectWebRtc } from "@meldrift/core/direct-webrtc";
import { liveLimits } from "../protocol";
import { peerFrameSchema, type PeerFrame } from "./protocol";

type ChannelEvents = { opened: () => void; closed: () => void; received: (frame: PeerFrame) => void };
const heartbeat = "heartbeat";
const channelLabel = "meldrift-live";

export class LivePeerChannel {
    readonly negotiation = new DirectWebRtc(process.env.NEXT_PUBLIC_PEER_LIVE_STUN_URLS);
    private channel: RTCDataChannel | undefined;
    private timer: ReturnType<typeof setInterval> | undefined;
    private lastSeen = Date.now();
    private stopped = false;

    constructor(offerer: boolean, private events: ChannelEvents) {
        const connection = this.negotiation.connection;
        connection.addEventListener("connectionstatechange", () => {
            if (connection.connectionState === "failed") {
                this.close();
            }
        });
        connection.addEventListener("datachannel", ({ channel }) => this.attach(channel));
        if (offerer) {
            this.attach(connection.createDataChannel(channelLabel));
        }
    }

    get open() {
        return !this.stopped && this.channel?.readyState === "open";
    }

    send(frame: PeerFrame) {
        if (this.open && this.channel!.bufferedAmount < liveLimits.messageBytes * 2) {
            this.write(JSON.stringify(frame));
        }
    }

    close() {
        if (!this.stopped) {
            this.stopped = true;
            clearInterval(this.timer);
            this.channel?.close();
            this.negotiation.connection.close();
            this.events.closed();
        }
    }

    private write(data: string) {
        try {
            this.channel?.send(data);
        } catch {
            this.close();
        }
    }

    private attach(channel: RTCDataChannel) {
        if (this.channel || channel.label !== channelLabel) {
            channel.close();
            return;
        }
        this.channel = channel;
        channel.addEventListener("close", () => this.close(), { once: true });
        channel.addEventListener("error", () => this.close(), { once: true });
        channel.addEventListener("open", () => {
            this.lastSeen = Date.now();
            this.timer = setInterval(() => {
                if (Date.now() - this.lastSeen > 20_000) {
                    this.close();
                } else {
                    this.write(heartbeat);
                }
            }, liveLimits.heartbeatMs);
            this.events.opened();
        }, { once: true });
        channel.addEventListener("message", ({ data }) => {
            if (typeof data !== "string" || data.length > liveLimits.messageBytes) {
                this.close();
                return;
            }
            this.lastSeen = Date.now();
            if (data !== heartbeat) {
                this.receive(data);
            }
        });
    }

    private receive(raw: string) {
        try {
            const frame = peerFrameSchema.parse(JSON.parse(raw));
            this.events.received(frame);
        } catch {
            this.close();
        }
    }
}
