import type { Request } from "express";
import {
    type BoardMeta,
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

function consumeBoardFlashMessage(req: Request): string | null {
    const value = req.session.boardFlashMessage;
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }
    delete req.session.boardFlashMessage;
    return value;
}

function getViewerContext(req: Request) {
    const userId = Number(req.session.userId);
    const isAuthenticated = Number.isFinite(userId) && userId > 0;
    const isAdmin = req.session.userRole === "admin";
    return { userId, isAuthenticated, isAdmin };
}

function canAccessBoardDirectory(req: Request, board: BoardMeta): boolean {
    const { isAuthenticated, isAdmin } = getViewerContext(req);
    if (board.readAccess === "public") {
        return true;
    }
    if (board.readAccess === "admin") {
        return isAdmin;
    }
    return isAuthenticated;
}

function canCreateForBoard(req: Request, board: BoardMeta | null): boolean {
    if (!board) {
        return false;
    }

    const { isAuthenticated, isAdmin } = getViewerContext(req);
    if (!isAuthenticated) {
        return false;
    }

    return board.createAccess === "admin" ? isAdmin : true;
}

function canReadPost(req: Request, board: BoardMeta | null, postUserId: number): boolean {
    if (!board) {
        return true;
    }

    if (board.readAccess !== "owner_or_admin") {
        return true;
    }

    const { userId, isAdmin } = getViewerContext(req);
    return isAdmin || userId === postUserId;
}

export async function buildBoardIndexViewModel(req: Request) {
    const boards = (await listBoards()).filter((board) => canAccessBoardDirectory(req, board));

    return {
        boardSlug: null,
        boardDisplayName: "Boards",
        boardDescription: null,
        formSuccess: null,
        canCreate: false,
        boards,
    };
}

export async function buildBoardSlugViewModel(req: Request, slug: string) {
    const board = await findBoardBySlug(slug);
    const page = parsePositiveInt(req.query.page, 1);
    const formSuccess = consumeBoardFlashMessage(req);

    const totalCount = await countBoardPostsBySlug(slug);
    const limit = PAGINATION_DEFAULT_LIMIT;

    const totalPages = createPaginationMeta(totalCount, limit);
    const offset = (page - 1) * limit;

    const outlines = await listBoardPostOutlinesBySlug({
        slug,
        offset,
        limit,
    });

    const postOutlines = outlines.map((post) => {
        const canOpen = canReadPost(req, board, post.userId);
        return {
            ...post,
            title: canOpen ? post.title : "비밀글",
            canOpen,
        };
    });

    return {
        boardSlug: slug,
        boardDisplayName: board?.name ?? slug,
        boardDescription: board?.description ?? null,
        formSuccess,
        canCreate: canCreateForBoard(req, board),
        postOutlines,
        pagination: {
            page,
            totalPages,
            totalCount,
            limit,
        },
    };
}
