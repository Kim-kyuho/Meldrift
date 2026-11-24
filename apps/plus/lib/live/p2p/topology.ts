import { LivePeerChannel } from "./peer-channel";
import type { Negotiation, PeerEvent, PeerFrame, PeerSignal, RoomView } from "./protocol";

type Link = {
    attemptId: string;
    channel: LivePeerChannel;
    acceptedAnswer: boolean;
};

type TopologyEvents = {
    signal: (signal: PeerSignal) => void;
    changed: () => void;
    received: (clientId: string, event: PeerEvent) => void;
};

// The room coordinator chooses the host. This class only manages the approved peer connections.
export class PeerTopology {
    private view: RoomView | null = null;
    private links = new Map<string, Link>();
    private retired = new Set<string>();

    constructor(private clientId: string, private events: TopologyEvents) {}

    get hosting() {
        return this.view?.hostId === this.clientId;
    }

    get ready() {
        return this.hosting || this.links.get(this.clientId)?.channel.open === true;
    }

    reconcile(view: RoomView) {
        if (this.view?.epoch !== view.epoch) {
            this.clear();
        }
        this.view = view;
        const current = new Map(view.negotiations.map((link) => [link.guestId, link]));
        for (const [guestId, link] of this.links) {
            if (current.get(guestId)?.attemptId !== link.attemptId) {
                this.links.delete(guestId);
                link.channel.close();
            }
        }
        for (const id of this.retired) {
            if (!view.negotiations.some(({ attemptId }) => attemptId === id)) {
                this.retired.delete(id);
            }
        }
        for (const negotiation of view.negotiations) {
            if (!this.retired.has(negotiation.attemptId)) {
                this.connect(negotiation);
            }
        }
    }

    send(event: PeerEvent) {
        if (this.hosting) {
            this.broadcast({ from: this.clientId, event });
        } else {
            this.links.get(this.clientId)?.channel.send({ event });
        }
    }

    clear() {
        const links = [...this.links.values()];
        this.links.clear();
        this.retired.clear();
        this.view = null;
        links.forEach(({ channel }) => channel.close());
    }

    private connect(negotiation: Negotiation) {
        const { guestId, attemptId, connected, offer, answer } = negotiation;
        const existing = this.links.get(guestId);
        if (existing) {
            if (this.hosting && answer && !existing.acceptedAnswer) {
                existing.acceptedAnswer = true;
                void existing.channel.negotiation.acceptAnswer(answer).catch(() => existing.channel.close());
            }
            return;
        }
        if (connected) {
            this.retry(guestId, attemptId);
            return;
        }
        const hosting = this.hosting;
        if (!hosting && !offer) {
            return;
        }
        const link: Link = {
            attemptId, acceptedAnswer: false,
            channel: new LivePeerChannel(hosting, {
                opened: () => {
                    if (this.links.get(guestId) !== link) {
                        return;
                    }
                    if (hosting) {
                        this.events.signal({ kind: "connected", guestId, attemptId });
                    }
                    this.events.changed();
                },
                closed: () => {
                    if (this.links.get(guestId) === link) {
                        this.links.delete(guestId);
                        this.retry(guestId, attemptId);
                        this.events.changed();
                    }
                },
                received: (frame) => this.receive(guestId, frame),
            }),
        };
        this.links.set(guestId, link);
        const send = (sdp: string) => {
            if (this.links.get(guestId) === link) {
                this.events.signal({ kind: hosting ? "offer" : "answer", guestId, attemptId, sdp });
            }
        };
        const rtc = link.channel.negotiation;
        const description = hosting ? rtc.offer() : rtc.answer(offer!);
        void description.then(send).catch(() => link.channel.close());
    }

    private retry(guestId: string, attemptId: string) {
        this.retired.add(attemptId);
        this.events.signal({ kind: "retry", guestId, attemptId });
    }

    private receive(guestId: string, frame: PeerFrame) {
        const from = this.hosting ? guestId : frame.from;
        if (!from || from === this.clientId) {
            return;
        }
        if (frame.event.kind === "refresh" || this.view?.peers.some(({ clientId }) => clientId === from)) {
            this.events.received(from, frame.event);
            if (this.hosting) {
                this.broadcast({ from, event: frame.event }, guestId);
            }
        }
    }

    private broadcast(frame: PeerFrame, except?: string) {
        for (const [id, link] of this.links) {
            if (id !== except) {
                link.channel.send(frame);
            }
        }
    }
}
