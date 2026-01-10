import type { Request } from "express";
import {
    countBoardPosts,
    countBoardPostsBySlug,
    findBoardDisplayNameBySlug,
    listBoardPostOutlines,
    listBoardPostOutlinesBySlug,
} from "../services/board.service.ts";
import { createPaginationMeta } from "../utils/board.util.ts";
import { PAGINATION_DEFAULT_LIMIT } from "../constants/board.constants.ts";


// page 파싱 로직은 재사용 가능하게 분리해두면 좋음
function parsePositiveInt(rawValue: unknown, fallback: number): number {
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export async function buildBoardIndexViewModel(req: Request) {
    const page = parsePositiveInt(req.query.page, 1);

    const totalCount = await countBoardPosts();
    const limit = PAGINATION_DEFAULT_LIMIT; // 기본값 10

    const totalPages = createPaginationMeta(totalCount, limit);
    const offset = (page - 1) * limit;

    const postOutlines = await listBoardPostOutlines({
        offset,
        limit
    });

    return {
        boardSlug: null,
        boardDisplayName: "Board",
        postOutlines,
        pagination: {
            page,
            totalPages,
            totalCount,
            limit,
        },
    };
}

export async function buildBoardSlugViewModel(req: Request, slug: string) {
    const page = parsePositiveInt(req.query.page, 1);

    const totalCount = await countBoardPostsBySlug(slug);
    const limit = PAGINATION_DEFAULT_LIMIT;

    const totalPages = createPaginationMeta(totalCount, limit);
    const offset = (page - 1) * limit;

    const postOutlines = await listBoardPostOutlinesBySlug({
        slug,
        offset,
        limit,
    });
    const boardDisplayName = await findBoardDisplayNameBySlug(slug);

    return {
        boardSlug: slug,
        boardDisplayName: boardDisplayName ?? slug,
        postOutlines,
        pagination: {
            page,
            totalPages,
            totalCount,
            limit,
        },
    };
}
