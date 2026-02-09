import type { Request } from "express";
import {
    countBoardPostsBySlug,
    findBoardBySlug,
    listBoardPostOutlinesBySlug,
    listBoards,
} from "../services/board.service.js";
import { createPaginationMeta } from "../utils/board.util.js";
import { PAGINATION_DEFAULT_LIMIT } from "../constants/board.constants.js";

function parsePositiveInt(rawValue: unknown, fallback: number): number {
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function canCreateForBoardSlug(req: Request, slug: string | null): boolean {
    const userId = Number(req.session.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        return false;
    }

    if (slug === "announcement") {
        return req.session.userRole === "admin";
    }

    return true;
}

export async function buildBoardIndexViewModel(_req: Request) {
    const boards = await listBoards();

    return {
        boardSlug: null,
        boardDisplayName: "Boards",
        boardDescription: null,
        canCreate: false,
        boards,
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
    const board = await findBoardBySlug(slug);

    return {
        boardSlug: slug,
        boardDisplayName: board?.name ?? slug,
        boardDescription: board?.description ?? null,
        canCreate: canCreateForBoardSlug(req, slug),
        postOutlines,
        pagination: {
            page,
            totalPages,
            totalCount,
            limit,
        },
    };
}
