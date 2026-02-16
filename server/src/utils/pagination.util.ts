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
