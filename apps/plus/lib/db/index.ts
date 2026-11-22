import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export function getDb() {
    const connectionString = process.env.NEON_CONNECTION_STRING;

    if (!connectionString) {
        throw new Error("NEON_CONNECTION_STRING is not set");
    }

    if (process.env.NODE_ENV === "development" && connectionString === "postgresql://e2e:e2e@localhost/meldrift_e2e") {
        neonConfig.fetchEndpoint = "http://127.0.0.1:3103/sql";
    }
    const client = neon(connectionString);

    return drizzle(client);
}
