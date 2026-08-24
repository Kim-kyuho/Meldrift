import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            "@": projectRoot,
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./tests/setup.ts"],
        exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
        clearMocks: true,
        restoreMocks: true,
    },
});
