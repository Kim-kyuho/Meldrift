import { webcrypto } from "node:crypto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
    cleanup();
});

if (!window.crypto.subtle) {
    Object.defineProperty(window.crypto, "subtle", {
        configurable: true,
        value: webcrypto.subtle,
    });
}

if (!("PointerEvent" in window)) {
    Object.defineProperty(window, "PointerEvent", {
        configurable: true,
        value: MouseEvent,
    });
}

if (!("ResizeObserver" in window)) {
    Object.defineProperty(window, "ResizeObserver", {
        configurable: true,
        value: class ResizeObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    });
}

Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
