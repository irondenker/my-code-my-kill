export function createPaginationMeta(totalCount: number, limit: number) {
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    return totalPages
}
