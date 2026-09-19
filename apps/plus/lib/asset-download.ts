const hexDigest = async (bytes: BufferSource) => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    return [...new Uint8Array(await subtle.digest("SHA-256", bytes))]
        .map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export async function downloadAsset(boardEndpoint: string, assetId: string, signal?: AbortSignal) {
    const response = await fetch(`${boardEndpoint}/assets/${assetId}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("An image could not be downloaded.");
    const meta = await response.json();

    const data = new Uint8Array(meta.byteLength);
    let offset = 0;
    for (let index = 0; index < meta.chunkCount; index += 1) {
        const chunk = await fetch(`${boardEndpoint}/assets/${assetId}/chunks/${index}`, { signal });
        if (!chunk.ok) throw new Error("An image could not be downloaded.");
        const part = new Uint8Array(await chunk.arrayBuffer());
        if (offset + part.byteLength > data.byteLength) throw new Error("A downloaded image is longer than declared.");
        data.set(part, offset);
        offset += part.byteLength;
    }
    if (offset !== data.byteLength) throw new Error("A downloaded image is incomplete.");

    const digest = await hexDigest(data);
    if (digest !== null && digest !== meta.digest) throw new Error("A downloaded image failed its checksum.");

    return { data, mimeType: meta.mimeType as string };
}
