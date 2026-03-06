/**
 * 문자열 유틸 모음입니다.
 * (I/O 없이 동작하는 순수 함수만 둡니다.)
 */

/**
 * normalize/truncate 계열 함수에서 공통으로 사용하는 문자열 정규화 구현체입니다.
 */
function normalizeCore(value: unknown, fallback: string | null): string | null {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * 입력값을 문자열로 정규화(trim)합니다.
 *
 * 동작:
 * - `fallback` 미지정: 문자열이 아니거나 trim 결과가 비면 `""` 반환
 * - `fallback` 지정: 문자열이 아니거나 trim 결과가 비면 `fallback` 반환
 *
 * 오버로드를 통해 `fallback: null` 사용 시 `string | null` 반환 타입을 얻을 수 있습니다.
 *
 * @param value 후보 입력값
 * @param fallback 비어 있거나 문자열이 아닐 때 사용할 대체값(기본값: "")
 */
export function normalizeString(value: unknown): string;
export function normalizeString(value: unknown, fallback: string): string;
export function normalizeString(value: unknown, fallback: null): string | null;
export function normalizeString(value: unknown, fallback: string | null = ''): string | null {
  return normalizeCore(value, fallback);
}

/**
 * 입력값을 문자열로 정규화한 뒤 지정한 최대 길이로 제한합니다.
 *
 * 동작:
 * - `fallback` 미지정: 문자열이 아니거나 trim 결과가 비면 `""` 반환
 * - `fallback` 지정: 문자열이 아니거나 trim 결과가 비면 `fallback` 반환
 *
 * 오버로드를 통해 `fallback: null` 사용 시 `string | null` 반환 타입을 얻을 수 있습니다.
 *
 * @param value 길이 제한 대상 문자열 후보값
 * @param maxLength 허용 최대 길이
 * @param fallback 비어 있거나 문자열이 아닐 때 사용할 대체값(기본값: "")
 * @returns 최대 길이 제한이 적용된 문자열 또는 null
 */
export function truncateString(value: unknown, maxLength: number): string;
export function truncateString(value: unknown, maxLength: number, fallback: string): string;
export function truncateString(value: unknown, maxLength: number, fallback: null): string | null;
export function truncateString(
  value: unknown,
  maxLength: number,
  fallback: string | null = ''
): string | null {
  const normalized = normalizeCore(value, fallback);
  if (normalized === null) return null;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}
