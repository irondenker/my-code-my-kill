/**
 * 문자열 유틸 모음입니다.
 * (I/O 없이 동작하는 순수 함수만 둡니다.)
 */

/**
 * 입력이 문자열이면 trim 처리하고, 그 외 타입이면 빈 문자열로 정규화합니다.
 *
 * @param value 후보 입력값
 */
export function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

/**
 * 입력이 문자열이면 trim 처리 후, 빈 문자열이 아니면 반환하고 아니면 null을 반환합니다.
 *
 * @param value 후보 입력값
 */
export function normalizeNullableString(value: unknown): string | null {
    const trimmed = normalizeString(value);
    return trimmed ? trimmed : null;
}

/**
 * 입력을 문자열로 정규화한 뒤 소문자로 변환합니다.
 *
 * @param value 후보 입력값
 */
export function normalizeLowerString(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

/**
 * nullable 문자열 길이를 지정한 최대 길이로 제한합니다.
 *
 * @param value 길이 제한 대상 문자열(null 허용)
 * @param maxLength 허용 최대 길이
 * @returns 잘린 문자열 또는 null
 */
export function truncateNullableString(value: string | null, maxLength: number): string | null {
    if (!value) {
        return null;
    }
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}
