import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function verifyPassword(password: string, passwordHash: string) {
    const [salt, storedHash] = passwordHash.split(":");
    if (!salt || !storedHash) {
        return false;
    }
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    const storedKey = Buffer.from(storedHash, "hex");

    // timingSafeEqual은 길이가 다르면 던지므로 먼저 길이를 본다.
    if (derivedKey.length !== storedKey.length) {
        return false;
    }

    return timingSafeEqual(derivedKey, storedKey);
}
