# API Route 예외처리

## 기본 순서

```ts
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const permissionMessage = getCardPermissionMessage(currentUser);

    if (permissionMessage) {
      return NextResponse.json(
        { ok: false, message: permissionMessage },
        { status: 403 },
      );
    }

    const body = await request.json();

    if (!isValidBody(body)) {
      return NextResponse.json(
        { ok: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const db = getDb();
    const result = await db.insert(table).values(values).returning();

    return NextResponse.json(
      { ok: true, data: result[0] },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error message:", error);
    return NextResponse.json(
      { ok: false, message: "An error occurred." },
      { status: 500 },
    );
  }
}
```

## ID 검증

```ts
const idNumber = Number(id);

if (!Number.isInteger(idNumber) || idNumber <= 0) {
  return NextResponse.json(
    { ok: false, message: "Invalid id." },
    { status: 400 },
  );
}
```

## PATCH 업데이트 객체

요청 body에 들어온 필드만 업데이트한다.

```ts
const updates: Partial<typeof table.$inferInsert> = {};

if (body.content !== undefined) updates.content = body.content;
if (body.x !== undefined) updates.x = body.x;
if (body.y !== undefined) updates.y = body.y;

if (Object.keys(updates).length === 0) {
  return NextResponse.json(
    { ok: false, message: "No update fields were provided." },
    { status: 400 },
  );
}
```

## 존재하지 않는 데이터 체크

```ts
const updated = await db
  .update(table)
  .set(updates)
  .where(eq(table.id, idNumber))
  .returning();

if (!updated[0]) {
  return NextResponse.json(
    { ok: false, message: "Data does not exist." },
    { status: 404 },
  );
}
```

Meldrift 적용 위치:

- `app/api/memos/route.ts`
- `app/api/memos/[id]/route.ts`
- `app/api/images/route.ts`
- `app/api/images/[id]/route.ts`
- `app/api/boards/route.ts`
- `app/api/boards/[boardId]/route.ts`
