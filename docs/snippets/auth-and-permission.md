# 인증과 권한

## 현재 유저 가져오기

세션 쿠키 원문을 SHA-256으로 해시하고, DB의 활성 세션과 일치하는 유저를 조회한다.

```ts
export async function getCurrentUserFromRequest(request: NextRequest) {
  const sessionTokenHash = getSessionTokenHash(
    request.cookies.get(sessionCookieName)?.value,
  );

  if (!sessionTokenHash) {
    return null;
  }

  const users = await db
    .select({ id, email, isApproved, role })
    .from(db_users)
    .where(and(
      eq(db_users.sessionTokenHash, sessionTokenHash),
      gt(db_users.sessionExpiresAt, new Date()),
    ))
    .limit(1);

  return users[0] ?? null;
}
```

## 권한 메시지

```ts
export function getCardPermissionMessage(
  user: Awaited<ReturnType<typeof getCurrentUserFromRequest>>,
) {
  if (!user) {
    return "Please sign in before editing cards.";
  }

  if (!user.isApproved) {
    return "Your account is waiting for administrator approval.";
  }

  return null;
}
```

## 세션 토큰

로그인마다 32바이트 난수를 새로 만들고 원문은 쿠키에만 보낸다.

```ts
export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}
```

DB에는 원문이 아니라 SHA-256 해시와 만료 시각을 저장한다.

```ts
export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionExpiresAt(now = Date.now()) {
  return new Date(now + sessionMaxAgeSeconds * 1000);
}
```

로그인 시 사용자 행의 기존 해시를 덮어쓰므로 같은 계정의 이전 기기 세션은 무효화된다. 로그아웃은 현재 쿠키 해시와 일치하는 행의 세션 해시와 만료 시각을 `null`로 만든다.

## 쿠키 설정

```ts
response.cookies.set(sessionCookieName, sessionToken, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: sessionMaxAgeSeconds,
});
```

Meldrift 적용 위치:

- `lib/auth/session.ts`
- `lib/auth/current-user.ts`
- `lib/auth/password.ts`
- `app/api/signin/route.ts`
- `app/api/signout/route.ts`
- `app/api/signup/route.ts`
- `app/api/me/route.ts`
- `hooks/useBoardAuth.ts`
