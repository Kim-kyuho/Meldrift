// 실패 횟수를 인스턴스 메모리에만 셈 - 완전 차단이 아니라 속도만 늦추는 용도
export const maxFailedAttempts = 5;
export const lockoutWindowMs = 5 * 60 * 1000;

export type AttemptRecord = { failures: number; firstFailureAt: number };

export type AttemptStore = Map<string, AttemptRecord>;

export const failedAttempts: AttemptStore = new Map();

// 제한 시간 지난 기록은 버림
const getLiveRecord = (key: string, now: number, store: AttemptStore) => {
    const record = store.get(key);

    if (!record) {
        return undefined;
    }

    if (now - record.firstFailureAt >= lockoutWindowMs) {
        store.delete(key);
        return undefined;
    }

    return record;
};

export function isThrottled(key: string, now = Date.now(), store: AttemptStore = failedAttempts) {
    return (getLiveRecord(key, now, store)?.failures ?? 0) >= maxFailedAttempts;
}

export function recordFailure(key: string, now = Date.now(), store: AttemptStore = failedAttempts) {
    const record = getLiveRecord(key, now, store);

    if (record) {
        record.failures += 1;
        return record.failures;
    }

    store.set(key, { failures: 1, firstFailureAt: now });

    return 1;
}

export function clearFailures(key: string, store: AttemptStore = failedAttempts) {
    store.delete(key);
}

// 프록시 뒤에서는 소켓 주소가 다 같아서 전달 헤더를 먼저 봄
export const getAttemptKey = (headers: Headers) =>
    headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
