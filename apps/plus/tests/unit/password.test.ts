import { scrypt } from "node:crypto";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";

const scryptAsync = promisify(scrypt);

describe("verifyPassword 동작", () => {
    it("올바른 비밀번호는 허용하고 다른 비밀번호는 거부한다", async () => {
        const salt = "test-salt";
        const key = await scryptAsync("correct-password", salt, 64) as Buffer;
        const passwordHash = `${salt}:${key.toString("hex")}`;

        await expect(verifyPassword("correct-password", passwordHash)).resolves.toBe(true);
        await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
    });

    it.each(["", "salt", ":hash", "salt:"])("잘못된 해시 %s를 거부한다", async (hash) => {
        await expect(verifyPassword("password", hash)).resolves.toBe(false);
    });

    it("바이트 길이가 다른 저장 키를 거부한다", async () => {
        await expect(verifyPassword("password", "salt:aa")).resolves.toBe(false);
    });
});
