/**
 * 인증 관련 입력 정규화/검증 유틸입니다.
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
 * username 문자열이 유효한 길이인지 판정합니다.
 *
 * @param username username(정규화된 문자열)
 */
export function isValidUsername(username: string): boolean {
    return username.length >= 3 && username.length <= 50;
}

/**
 * password 문자열이 유효한 길이인지 판정합니다.
 *
 * @param password password(평문)
 */
export function isValidPassword(password: string): boolean {
    return password.length >= 8 && password.length <= 128;
}
