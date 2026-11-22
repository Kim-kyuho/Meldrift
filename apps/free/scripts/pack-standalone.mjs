import { cpSync, writeFileSync } from "node:fs";

const app = new URL("../", import.meta.url);
const standalone = new URL(".next/standalone/", app);
const standaloneApp = new URL("apps/free/", standalone);

// Next.js leaves public files and client bundles out of the standalone build.
cpSync(new URL("public/", app), new URL("public/", standaloneApp), { recursive: true });
cpSync(new URL(".next/static/", app), new URL(".next/static/", standaloneApp), { recursive: true });

// Keep the monorepo layout and expose a server entry at the deployment root.
writeFileSync(new URL("server.js", standalone), 'require("./apps/free/server.js");\n');
