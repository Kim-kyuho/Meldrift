import { DirectWebRtc } from "@meldrift/core/direct-webrtc";
import { PacketChannel, type Packet } from "./packets";

export { directCollaborationSupported } from "@meldrift/core/direct-webrtc";

type LinkEvents = {
    onOpen: () => void;
    onClose: (message: string) => void;
    onControl: (message: unknown) => void;
    onPresence: (message: unknown) => void;
    onPacket: (packet: Packet) => void;
};

const heartbeatMs = 5_000;
const silentMs = 20_000;
const channelNames = ["control", "bulk", "presence"] as const;
type ChannelName = typeof channelNames[number];

export class PeerLink {
    private readonly negotiation = new DirectWebRtc(process.env.NEXT_PUBLIC_PEER_LIVE_STUN_URLS);
    private readonly connection = this.negotiation.connection;
    private channels = new Map<ChannelName, RTCDataChannel>();
    private packets: PacketChannel | null = null;
    private heartbeat: ReturnType<typeof setInterval> | undefined;
    private lastSeen = Date.now();
    private closed = false;
    private open = false;

    constructor(offerer: boolean, private readonly events: LinkEvents) {
        this.connection.onconnectionstatechange = () => {
            if (this.connection.connectionState === "failed") {
                this.close("Could not establish a direct connection.");
            }
        };
        this.connection.ondatachannel = ({ channel }) => this.attach(channel);
        if (offerer) {
            this.attach(this.connection.createDataChannel("control"));
            this.attach(this.connection.createDataChannel("bulk"));
            this.attach(this.connection.createDataChannel("presence", { ordered: false, maxRetransmits: 0 }));
        }
    }

    async offer() {
        return this.negotiation.offer();
    }

    async answer(sdp: string) {
        return this.negotiation.answer(sdp);
    }

    async acceptAnswer(sdp: string) {
        return this.negotiation.acceptAnswer(sdp);
    }

    sendControl(message: unknown) {
        this.sendJson("control", message);
    }

    sendPresence(message: unknown) {
        this.sendJson("presence", message);
    }

    async sendPacket(packet: Packet) {
        if (!this.packets || !this.open) {
            throw new Error("The peer is not connected.");
        }
        try {
            await this.packets.send(packet);
        } catch (error) {
            this.close("Could not complete the board transfer.");
            throw error;
        }
    }

    close(message = "The peer disconnected.") {
        if (this.closed) {
            return;
        }
        this.closed = true;
        clearInterval(this.heartbeat);
        for (const channel of this.channels.values()) {
            channel.close();
        }
        this.connection.close();
        this.events.onClose(message);
    }

    private attach(channel: RTCDataChannel) {
        const name = channel.label as ChannelName;
        if (!channelNames.includes(name) || this.channels.has(name)) {
            channel.close();
            return;
        }
        this.channels.set(name, channel);
        channel.addEventListener("close", () => this.close(), { once: true });
        channel.addEventListener("error", () => this.close(), { once: true });
        channel.addEventListener("open", () => this.checkOpen(), { once: true });
        if (name === "bulk") {
            this.packets = new PacketChannel(channel, () => this.connection.sctp?.maxMessageSize ?? 0,
                (packet) => this.events.onPacket(packet), (error) => this.close(error.message));
        } else {
            channel.addEventListener("message", (event: MessageEvent<unknown>) => this.receive(name, event.data));
        }
        this.checkOpen();
    }

    private checkOpen() {
        if (this.open || this.closed || !channelNames.every((name) => this.channels.get(name)?.readyState === "open")) {
            return;
        }
        this.open = true;
        this.lastSeen = Date.now();
        this.heartbeat = setInterval(() => {
            if (Date.now() - this.lastSeen >= silentMs) {
                this.close("The direct connection stopped responding.");
            } else {
                this.sendControl({ kind: "heartbeat" });
            }
        }, heartbeatMs);
        this.events.onOpen();
    }

    private sendJson(name: "control" | "presence", data: unknown) {
        const channel = this.channels.get(name);
        if (channel?.readyState !== "open" || this.closed) {
            return;
        }
        // Pointer frames can be skipped when they would queue behind older frames.
        if (name === "presence" && channel.bufferedAmount > 16 * 1024) {
            return;
        }
        try {
            channel.send(JSON.stringify(data));
        } catch {
            this.close();
        }
    }

    private receive(name: "control" | "presence", data: unknown) {
        if (typeof data !== "string" || data.length > 64 * 1024) {
            this.close("The peer sent an invalid message.");
            return;
        }
        try {
            const message = JSON.parse(data);
            this.lastSeen = Date.now();
            if (name === "presence") {
                this.events.onPresence(message);
            } else if (message?.kind !== "heartbeat") {
                this.events.onControl(message);
            }
        } catch {
            this.close("The peer sent an invalid message.");
        }
    }
}
