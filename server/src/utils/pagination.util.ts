/**
 * 페이지네이션을 위한 "총 페이지 수"를 계산합니다.
 *
 * 정책:
 * - totalCount가 0이어도 최소 1 페이지로 취급합니다.
 * - limit이 1 미만이면 1로 보정합니다.
 *
 * @param totalCount 전체 항목 개수
 * @param limit 페이지당 항목 개수
 */
export function computeTotalPages(totalCount: number, limit: number): number {
    const normalizedLimit = Math.max(Math.trunc(limit), 1);
    const totalPages = Math.max(Math.ceil(totalCount / normalizedLimit), 1);
    return totalPages;
}

/**
 * 양의 정수 쿼리값을 정규화합니다.
 * 숫자가 아니거나 1 미만이면 fallback을 반환합니다.
 */
export function parsePositiveInt(rawValue: unknown, fallback: number): number {
    if (typeof rawValue === "number") {
        return Number.isInteger(rawValue) && rawValue > 0 ? rawValue : fallback;
    }

    if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        if (!/^[0-9]+$/.test(trimmed)) {
            return fallback;
        }

        const value = Number.parseInt(trimmed, 10);
        return value > 0 ? value : fallback;
    }

    return fallback;
}

/**
 * 허용 옵션 기반 limit 값을 정규화합니다.
 * - 숫자가 아니거나 1 미만이면 defaultLimit
 * - maxLimit 초과면 maxLimit으로 보정
 * - allowedOptions에 없는 값이면 defaultLimit
 */
export function normalizeLimitByOptions(params: {
    rawValue: unknown;
    defaultLimit: number;
    maxLimit: number;
    allowedOptions: readonly number[];
}): number {
    const parsed = parsePositiveInt(params.rawValue, params.defaultLimit);
    const clamped = Math.min(parsed, params.maxLimit);
    return params.allowedOptions.includes(clamped) ? clamped : params.defaultLimit;
}
