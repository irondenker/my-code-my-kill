/**
 * username 관련 검증 유틸입니다.
 * (I/O 없이 동작하는 순수 함수만 둡니다.)
 */

/**
 * username 문자열이 유효한 길이인지 판정합니다.
 */
export function isValidUsername(username: string): boolean {
    return username.length >= 3 && username.length <= 50;
}

/**
 * 공개 프로필 핸들로 노출 가능한 값인지 판정합니다.
 *
 * 정책:
 * - 빈 문자열 금지
 * - `@`로 시작하는 값은 핸들 표현과 혼동될 수 있어 금지
 *
 * @param value 핸들 문자열
 */
export function isPublicProfileHandle(value: string): boolean {
    if (!value) {
        return false;
    }

    if (value.startsWith("@")) {
        return false;
    }

    return true;
}
