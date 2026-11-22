import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword } from "../../lib/auth/password.ts";

const db = new PGlite();
const migrations = (await readdir("drizzle")).filter((file) => file.endsWith(".sql")).sort();
for (const file of migrations) {
    await db.exec(await readFile(`drizzle/${file}`, "utf8"));
}
await db.query(
    "INSERT INTO users (email, password_hash, permission_flg) VALUES ($1, $2, true)",
    ["owner@example.test", await hashPassword("Fixture-password-2026")],
);
await db.exec(`
    INSERT INTO boards (title, width, height, owner_id, private_flg)
    VALUES ('Playwright board', 7680, 4320, 'owner@example.test', 0);
    INSERT INTO memos (board_id, sync_id, content, x, y, width, height, color, sort_order)
    VALUES (1, 'memo-1', 'First memo', 90, 120, 250, 190, '#fff8a8', 1),
           (1, 'memo-2', 'Second memo', 410, 120, 250, 190, '#fff8a8', 2);
`);

// The fixture serves the same query and transaction envelope as Neon HTTP.
function postgresText(value, field) {
    if (value === null) {
        return null;
    }
    if (typeof value === "boolean") {
        return value ? "t" : "f";
    }
    if (value instanceof Uint8Array) {
        return "\\x" + Buffer.from(value).toString("hex");
    }
    if (value instanceof Date) {
        const iso = value.toISOString();
        return field.dataTypeID === 1114 ? iso.replace("T", " ").replace("Z", "") : iso;
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value);
}

async function query(client, { query, params }) {
    const { rows, fields, affectedRows } = await client.query(query, params, { rowMode: "array" });
    return {
        rowCount: affectedRows || rows.length,
        fields,
        rows: rows.map((row) => row.map((value, index) => postgresText(value, fields[index]))),
    };
}

createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/ready") {
        response.writeHead(200).end("ready");
        return;
    }
    if (request.method !== "POST" || request.url !== "/sql") {
        response.writeHead(404).end();
        return;
    }
    try {
        const chunks = [];
        for await (const chunk of request) {
            chunks.push(chunk);
        }
        const input = JSON.parse(Buffer.concat(chunks).toString());
        const data = input.queries ? { results: await db.transaction(async (tx) => {
            const results = [];
            for (const statement of input.queries) {
                results.push(await query(tx, statement));
            }
            return results;
        }) } : await query(db, input);
        response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(data));
    } catch (error) {
        const { message, code } = error;
        response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ message, code }));
    }
}).listen(3103, "127.0.0.1");
