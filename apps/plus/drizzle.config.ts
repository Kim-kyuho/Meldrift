import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const connectionString = process.env.NEON_CONNECTION_STRING;

if (!connectionString) {
    throw new Error("NEON_CONNECTION_STRING is not set");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./lib/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: connectionString,
    },
    strict: true,
    verbose: true,
});
