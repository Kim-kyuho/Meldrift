import { scrypt } from "node:crypto";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";

const scryptAsync = promisify(scrypt);

describe("verifyPassword", () => {
    it("accepts the correct password and rejects a different password", async () => {
        const salt = "test-salt";
        const key = await scryptAsync("correct-password", salt, 64) as Buffer;
        const passwordHash = `${salt}:${key.toString("hex")}`;

        await expect(verifyPassword("correct-password", passwordHash)).resolves.toBe(true);
        await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
    });

    it.each(["", "salt", ":hash", "salt:"])("rejects malformed hash %s", async (hash) => {
        await expect(verifyPassword("password", hash)).resolves.toBe(false);
    });

    it("rejects a stored key with a different byte length", async () => {
        await expect(verifyPassword("password", "salt:aa")).resolves.toBe(false);
    });
});
