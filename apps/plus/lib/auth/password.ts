import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// 패스워드 체크를 위한 라이브러리 
export async function verifyPassword(password: string, passwordHash: string) {
    
    // DB에 저장된 패스워드의 겂("salt":"storedHash")를 ":"로 스플릿
    const [salt, storedHash] = passwordHash.split(":");
    // ":"로 스플릿 한 값이 존재하지 않는 경우 false를 리턴
    if (!salt || !storedHash) {
        return false;
    }
    // 입력한 패스워드 + salt의 Hash값의 버퍼값(바이트 배열)
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    // storedHash(SignUp시점의 패스워드 + salt의 Hash값)의 버퍼값(바이트 배열)을 비교
    const storedKey = Buffer.from(storedHash, "hex");

    // 버퍼이 일치하지 않을 경우 false를 리턴
    if (derivedKey.length !== storedKey.length) {
        return false;
    }

    return timingSafeEqual(derivedKey, storedKey);
}
