export const maxBoardBytes = 50 * 1024 * 1024;
export const maxMetadataBytes = 8 * 1024 * 1024;
const chunkBytes = 16 * 1024;
const maxBufferedBytes = 512 * 1024;
const maxQueuedBytes = 64 * 1024 * 1024;
const stalledMs = 20_000;

export type Packet = { metadata: unknown; assets: Uint8Array[] };

type Incoming = {
    buffers: Uint8Array<ArrayBuffer>[];
    index: number;
    offset: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function validateLengths(value: unknown) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 1024) {
        throw new Error("Invalid board transfer header.");
    }
    let total = 0;
    for (const bytes of value) {
        if (!Number.isSafeInteger(bytes) || bytes <= 0) {
            throw new Error("Invalid board transfer size.");
        }
        total += bytes;
    }
    if (total > maxBoardBytes || value[0] > maxMetadataBytes) {
        throw new Error("This board transfer is too large.");
    }
    return { lengths: value as number[], total };
}

function waitForBuffer(channel: RTCDataChannel) {
    if (channel.bufferedAmount <= maxBufferedBytes) {
        return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
            clearTimeout(timer);
            channel.removeEventListener("bufferedamountlow", ready);
            channel.removeEventListener("close", closed);
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };
        const ready = () => finish();
        const closed = () => finish(new Error("The peer left during transfer."));
        const timer = setTimeout(() => finish(new Error("The board transfer timed out.")), stalledMs);
        channel.addEventListener("bufferedamountlow", ready, { once: true });
        channel.addEventListener("close", closed, { once: true });
        if (channel.readyState !== "open") {
            closed();
        } else if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) {
            ready();
        }
    });
}

export class PacketChannel {
    private incoming: Incoming | null = null;
    private receiveTimer: ReturnType<typeof setTimeout> | undefined;
    private outgoing = Promise.resolve();
    private queuedBytes = 0;

    constructor(
        private readonly channel: RTCDataChannel,
        private readonly maxMessageSize: () => number,
        private readonly onPacket: (packet: Packet) => void,
        private readonly onError: (error: Error) => void,
    ) {
        channel.binaryType = "arraybuffer";
        channel.bufferedAmountLowThreshold = 128 * 1024;
        channel.addEventListener("message", this.receive);
        channel.addEventListener("close", () => clearTimeout(this.receiveTimer), { once: true });
    }

    send(packet: Packet): Promise<void> {
        const buffers = [encoder.encode(JSON.stringify(packet.metadata)), ...packet.assets];
        const { lengths, total } = validateLengths(buffers.map(({ byteLength }) => byteLength));
        if (this.queuedBytes + total > maxQueuedBytes) {
            return Promise.reject(new Error("The peer is receiving too slowly."));
        }

        this.queuedBytes += total;
        const task = this.outgoing.then(async () => {
            const limit = Math.min(chunkBytes, this.maxMessageSize() || chunkBytes);
            const header = JSON.stringify(lengths);
            if (header.length > limit) {
                throw new Error("This peer cannot receive the transfer header.");
            }
            this.channel.send(header);
            for (const buffer of buffers) {
                for (let offset = 0; offset < buffer.byteLength; offset += limit) {
                    await waitForBuffer(this.channel);
                    // RTCDataChannel sends the view's byte range, not the entire backing buffer.
                    const chunk = buffer.subarray(offset, offset + limit);
                    if (chunk.buffer instanceof ArrayBuffer) {
                        this.channel.send(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                    } else {
                        this.channel.send(new Uint8Array(chunk));
                    }
                }
            }
        }).finally(() => {
            this.queuedBytes -= total;
        });
        this.outgoing = task.catch(() => {});
        return task;
    }

    private receive = (event: MessageEvent<unknown>) => {
        try {
            this.receiveFrame(event.data);
        } catch (error) {
            this.onError(error instanceof Error ? error : new Error("Could not read the shared board."));
        }
    };

    private receiveFrame(data: unknown) {
        clearTimeout(this.receiveTimer);
        if (typeof data === "string") {
            if (this.incoming || data.length > chunkBytes) {
                throw new Error("Unexpected board transfer header.");
            }
            const { lengths } = validateLengths(JSON.parse(data));
            this.incoming = { buffers: lengths.map((length) => new Uint8Array(length)), index: 0, offset: 0 };
        } else {
            if (!(data instanceof ArrayBuffer) || data.byteLength < 1 || data.byteLength > chunkBytes || !this.incoming) {
                throw new Error("Unexpected board transfer chunk.");
            }
            const incoming = this.incoming;
            const buffer = incoming.buffers[incoming.index];
            if (incoming.offset + data.byteLength > buffer.byteLength) {
                throw new Error("Invalid board transfer chunk size.");
            }
            buffer.set(new Uint8Array(data), incoming.offset);
            incoming.offset += data.byteLength;
            if (incoming.offset === buffer.byteLength) {
                incoming.index += 1;
                incoming.offset = 0;
            }
            if (incoming.index === incoming.buffers.length) {
                this.incoming = null;
                const [metadata, ...assets] = incoming.buffers;
                this.onPacket({ metadata: JSON.parse(decoder.decode(metadata)), assets });
                return;
            }
        }
        this.receiveTimer = setTimeout(() => this.onError(new Error("The board transfer timed out.")), stalledMs);
    }
}
