/**
 * 에러를 로그/표시 목적의 1줄 문자열로 요약합니다.
 * 긴 메시지는 잘라서 로그 폭주를 방지합니다.
 */
export function summarizeErrorMessage(error: unknown, maxLength = 180): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const compact = raw.replace(/\s+/g, ' ').trim();

  if (maxLength <= 0) {
    return '';
  }
  if (compact.length <= maxLength) {
    return compact;
  }
  const ellipsis = '...';
  const sliceLength = Math.max(maxLength - ellipsis.length, 0);
  return `${compact.slice(0, sliceLength)}${ellipsis}`;
}
