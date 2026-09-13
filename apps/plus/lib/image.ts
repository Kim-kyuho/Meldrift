export const supportedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageMimeType = (typeof supportedImageMimeTypes)[number];

const supportedImageMimeTypeSet = new Set<string>(supportedImageMimeTypes);

export const imageInputAccept = supportedImageMimeTypes.join(",");

export function isSupportedImageMimeType(value: string): value is SupportedImageMimeType {
    return supportedImageMimeTypeSet.has(value);
}
