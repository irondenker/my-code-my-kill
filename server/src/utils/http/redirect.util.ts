/**
 * 리다이렉트 경로 검증 유틸입니다.
 *
 * 목적:
 * - `next` 파라미터 등을 통한 open redirect를 방지합니다.
 * - 앱 내부의 상대 경로(`/...`)만 허용합니다.
 */

/**
 * value가 "앱 내부" 리다이렉트 경로로 안전한지 판정하는 type guard입니다.
 *
 * 규칙:
 * - 반드시 `/`로 시작
 * - `//`(프로토콜 상대) 금지
 * - `://`(스킴 포함) 금지
 * - `\\`(윈도우 경로/이스케이프) 금지
 *
 * @param value 후보 입력값
 */
function isSafeRedirectPath(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  if (value.length === 0) {
    return false;
  }

  if (!value.startsWith('/')) {
    return false;
  }

  if (value.startsWith('//')) {
    return false;
  }

  if (value.includes('://')) {
    return false;
  }

  if (value.includes('\\')) {
    return false;
  }

  return true;
}

/**
 * 안전한 리다이렉트 경로를 반환합니다.
 * value가 안전하지 않으면 fallback을 반환합니다.
 *
 * @param value 후보 입력값
 * @param fallback 기본 경로
 */
export function getSafeRedirectPath(value: unknown, fallback: string): string {
  return isSafeRedirectPath(value) ? value : fallback;
}
