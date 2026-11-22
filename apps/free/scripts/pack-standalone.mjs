import { accessSync, cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const app = new URL("../", import.meta.url);
const standalone = new URL(".next/standalone/", app);
const standaloneApp = new URL("apps/free/", standalone);
const staticAssets = new URL(".next/static/", app);
const deployBuild = new URL("../../.next/", app);
const deployStandalone = new URL("standalone/", deployBuild);
const deployStatic = new URL("static/", deployBuild);

console.log("Packing Meldrift Free standalone output...");
accessSync(new URL("server.js", standaloneApp));

// Next.js leaves public files and client bundles out of the standalone build.
cpSync(new URL("public/", app), new URL("public/", standaloneApp), { recursive: true });
cpSync(staticAssets, new URL(".next/static/", standaloneApp), { recursive: true });

// Keep the monorepo layout and expose a server entry at the deployment root.
writeFileSync(new URL("server.js", standalone), 'require("./apps/free/server.js");\n');

// Expose the artifacts at the repository root, where Deploy Now builds.
mkdirSync(deployBuild, { recursive: true });
rmSync(deployStatic, { recursive: true, force: true });
cpSync(staticAssets, deployStatic, { recursive: true });
rmSync(deployStandalone, { recursive: true, force: true });
renameSync(standalone, deployStandalone);
console.log("Deploy Now output ready: .next/standalone");
