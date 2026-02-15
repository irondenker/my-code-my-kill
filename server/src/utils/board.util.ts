/**
 * 페이지네이션을 위한 "총 페이지 수"를 계산합니다.
 *
 * 정책:
 * - totalCount가 0이어도 최소 1 페이지로 취급합니다.
 *
 * @param totalCount 전체 항목 개수
 * @param limit 페이지당 항목 개수
 */
export function createPaginationMeta(totalCount: number, limit: number): number {
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    return totalPages;
}
