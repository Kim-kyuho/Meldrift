import { describe, expect, it } from "vitest";
import {
    imageInputAccept,
    isSupportedImageMimeType,
    supportedImageMimeTypes,
} from "@/lib/image";

describe("image utilities", () => {
    it("recognizes supported image MIME types", () => {
        expect(isSupportedImageMimeType("image/jpeg")).toBe(true);
        expect(isSupportedImageMimeType("image/png")).toBe(true);
        expect(isSupportedImageMimeType("image/webp")).toBe(true);
    });

    it("rejects unsupported MIME types", () => {
        expect(isSupportedImageMimeType("image/svg+xml")).toBe(false);
        expect(isSupportedImageMimeType("image/gif")).toBe(false);
        expect(isSupportedImageMimeType("text/html")).toBe(false);
        expect(isSupportedImageMimeType("application/javascript")).toBe(false);
        expect(isSupportedImageMimeType("")).toBe(false);
    });

    it("provides the correct accept string for file inputs", () => {
        expect(imageInputAccept).toBe("image/jpeg,image/png,image/webp");
        expect(supportedImageMimeTypes).toEqual(["image/jpeg", "image/png", "image/webp"]);
    });
});
