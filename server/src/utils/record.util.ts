/**
 * 객체(Record) 형태 정규화 유틸 모음입니다.
 * (I/O 없이 동작하는 순수 함수만 둡니다.)
 */

/**
 * 입력을 "plain object"처럼 취급 가능한 `Record<string, unknown>`로 정규화합니다.
 * - 객체가 아니거나, null이거나, 배열이면 빈 객체로 폴백합니다.
 *
 * @param value 후보 입력값
 * @returns JSON 저장 가능한 객체
 */
export function sanitizeRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

