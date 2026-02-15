/**
 * 문자열 유틸 모음입니다.
 * (I/O 없이 동작하는 순수 함수만 둡니다.)
 */

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

