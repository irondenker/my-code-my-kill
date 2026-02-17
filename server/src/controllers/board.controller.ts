import type { Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";
import {
    buildViewerContext,
    getBoardReadAccessResult,
} from "../utils/board.policy.util.js";
import {
    findBoardBySlug,
    listBoards,
} from "../services/board.service.js";
import {
    countArticlesBySlug,
    listArticleOutlinesBySlug,
} from "../services/article.service.js";
import { computeTotalPages } from "../utils/pagination.util.js";
import { PAGINATION_DEFAULT_LIMIT } from "../constants/board.constants.js";
import { getStringParamOrThrow } from "../utils/route-param.util.js";
import { consumeSessionFlashMessage } from "../utils/session-flash.util.js";

/**
 * 보드 컨트롤러입니다.
 *
 * 원칙:
 * - 컨트롤러는 HTTP 흐름(req/res/session/redirect/render)만 담당합니다.
 * - 순수 판정/정규화는 `utils`로, DB/파일 I/O는 `services`로 위임합니다.
 */

/**
 * 양의 정수를 파싱합니다.
 * 숫자가 아니거나 1 미만이면 fallback을 반환합니다.
 */
function parsePositiveInt(rawValue: unknown, fallback: number): number {
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/**
 * 보드 디렉토리(목록) 접근 여부를 판정합니다.
 * readAccess 정책 중 `owner_or_admin`은 "게시글 단위" 정책이라 목록 접근엔 적용하지 않습니다.
 */
function canAccessBoardDirectory(req: Request, board: NonNullable<Awaited<ReturnType<typeof findBoardBySlug>>>): boolean {
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);

    if (board.readAccess === "public") {
        return true;
    }
    if (board.readAccess === "admin") {
        return viewerContext.isAdmin;
    }
    return viewerContext.isAuthenticated;
}

/**
 * 보드 목록/게시글 목록 화면에서 "글쓰기" 버튼 노출 여부를 판정합니다.
 */
function canCreateForBoard(req: Request, board: Awaited<ReturnType<typeof findBoardBySlug>>): boolean {
    if (!board) {
        return false;
    }

    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!viewerContext.isAuthenticated) {
        return false;
    }

    return board.createAccess === "admin" ? viewerContext.isAdmin : true;
}

/**
 * owner_or_admin 보드에서 특정 게시글(작성자) 열람 가능 여부를 판정합니다.
 * 기타 readAccess는 컨트롤러에서 이미 처리되므로 여기서는 통과로 봅니다.
 */
function canReadPost(req: Request, board: Awaited<ReturnType<typeof findBoardBySlug>>, postUserId: number): boolean {
    if (!board) {
        return true;
    }

    if (board.readAccess !== "owner_or_admin") {
        return true;
    }

    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    return viewerContext.isAdmin || viewerContext.viewerUserId === postUserId;
}

/**
 * slug로 보드를 조회하고, 없으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
async function requireBoardBySlug(slug: string) {
    const board = await findBoardBySlug(slug);
    if (!board) {
        throw new HttpError(404, "Not Found");
    }
    return board;
}

/**
 * 전체 보드 목록(`/board`)을 렌더링합니다.
 */
export async function getBoardIndex(req: Request, res: Response) {
    // 1) 전체 보드 목록에서 현재 세션 기준으로 접근 가능한 보드만 노출합니다.
    const boards = (await listBoards()).filter((board) => canAccessBoardDirectory(req, board));

    // 2) 디렉토리 화면 전용 모델(보드 미선택 상태)을 렌더링합니다.
    return res.render("board/index", {
        boardSlug: null,
        boardDisplayName: "Boards",
        boardDescription: null,
        formSuccess: null,
        canCreate: false,
        boards,
    });
}

/**
 * 특정 보드의 글 목록(`/board/:slug`)을 렌더링합니다.
 * 보드 readAccess 정책에 따라 401/403을 반환할 수 있습니다.
 */
export async function getBoardBySlug(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const board = await requireBoardBySlug(slug);

    // 1) 보드 단위 readAccess 정책을 먼저 평가합니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const readAccessResult = getBoardReadAccessResult(board, viewerContext);
    if (readAccessResult === "unauthorized") {
        throw new HttpError(401, "Unauthorized");
    }
    if (readAccessResult === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }

    // 2) 페이지네이션 파라미터를 정규화하고, 목록 상단에 노출할 플래시 메시지를 소비합니다.
    const page = parsePositiveInt(req.query.page, 1);
    const formSuccess = consumeSessionFlashMessage(req, "boardFlashMessage");

    // 3) 전체 개수 -> 페이지 메타 계산 -> 현재 페이지 오프셋 계산 순서로 목록을 조회합니다.
    const totalCount = await countArticlesBySlug(slug);
    const limit = PAGINATION_DEFAULT_LIMIT;

    const totalPages = computeTotalPages(totalCount, limit);
    const offset = (page - 1) * limit;

    const outlines = await listArticleOutlinesBySlug({
        slug,
        offset,
        limit,
    });

    // 4) owner_or_admin 보드는 "게시글 단위"로 열람 가능 여부가 갈리므로,
    //    목록에서는 열람 불가 글의 제목을 마스킹하고 "열기 가능 여부" 플래그를 내려줍니다.
    const postOutlines = outlines.map((post) => {
        const canOpen = canReadPost(req, board, post.userId);
        return {
            ...post,
            title: canOpen ? post.title : "비밀글",
            canOpen,
        };
    });

    return res.render("board/index", {
        boardSlug: slug,
        boardDisplayName: board.name,
        boardDescription: board.description ?? null,
        formSuccess,
        canCreate: canCreateForBoard(req, board),
        postOutlines,
        pagination: {
            page,
            totalPages,
            totalCount,
            limit,
        },
    });
}
