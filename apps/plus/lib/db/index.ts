import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export function getDb() {
    const connectionString = process.env.NEON_CONNECTION_STRING;

    if (!connectionString) {
        throw new Error("NEON_CONNECTION_STRING is not set");
    }

    const client = neon(connectionString);

    return drizzle(client);
}
