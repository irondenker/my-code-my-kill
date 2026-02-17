import type { Request, Response } from "express";
import type { ArticleRecord } from "../types/article.types.js";
import type { BoardMeta, BoardReadAccess, ViewerContext } from "../types/board.types.js";
import { HttpError } from "../utils/http-error.js";
import {
    buildViewerContext,
    getBoardCreateAccessResult,
    getBoardReadAccessResult,
} from "../utils/board.policy.util.js";
import {
    canDeleteArticle,
    canEditArticle,
    canReadArticleForBoard,
    getArticleMutationPolicy,
} from "../utils/article.policy.util.js";
import {
    type ArticleFormInput,
    buildArticleCreateFormViewModel,
    buildArticleEditFormViewModel,
} from "../utils/article-form.util.js";
import { parseArticleForm } from "../schemas/article.schema.js";

/**
 * 게시글 컨트롤러에서 재사용하는 보조 함수 모음입니다.
 *
 * 역할:
 * - 세션/보드/게시글 정책 결과를 HTTP 예외(401/403/404)로 변환
 * - 폼 입력 파싱 및 뷰 모델 렌더링 공통화
 * - 목록/상세 화면에서 필요한 권한 파생값 계산
 */
export function getUploadedFile(req: Request, fieldName: string): Express.Multer.File | null {
    const files = req.files;
    if (!files) {
        return null;
    }
    if (Array.isArray(files)) {
        return files.find((file) => file.fieldname === fieldName) ?? null;
    }
    const fieldFiles = files[fieldName];
    return fieldFiles?.[0] ?? null;
}

export function ensureBoardCreateAccess(req: Request, board: Pick<BoardMeta, "createAccess">): ViewerContext {
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const createAccess = getBoardCreateAccessResult(board, viewerContext);
    // 정책 유틸 결과를 컨트롤러 레벨의 표준 HTTP 오류로 매핑합니다.
    if (createAccess === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }
    if (createAccess === "redirect_login") {
        throw new HttpError(401, "Unauthorized");
    }
    return viewerContext;
}

export function ensureBoardReadAccess(req: Request, board: Pick<BoardMeta, "readAccess">): ViewerContext {
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const readAccessResult = getBoardReadAccessResult(board, viewerContext);
    // "로그인 필요(401)"와 "권한 부족(403)"을 명확히 구분해 에러 핸들러로 전달합니다.
    if (readAccessResult === "unauthorized") {
        throw new HttpError(401, "Unauthorized");
    }
    if (readAccessResult === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }
    return viewerContext;
}

export function ensurePostEditAccess(req: Request, post: Pick<ArticleRecord, "boardSlug" | "userId">): ViewerContext {
    const policy = getArticleMutationPolicy(post.boardSlug);
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!canEditArticle(policy, viewerContext, post.userId)) {
        throw new HttpError(403, "Forbidden");
    }
    return viewerContext;
}

export function resolveArticleDeletePlan(
    req: Request,
    slug: string
): { mode: "admin" | "selfOrAdmin"; requestUserId: number } {
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const requestUserId = requireAuthenticatedViewerId(viewerContext);
    const policy = getArticleMutationPolicy(slug);

    // 공지 보드처럼 관리자 삭제 전용 정책이면 실행 모드를 강제 전환합니다.
    if (policy.delete === "admin") {
        if (!viewerContext.isAdmin) {
            throw new HttpError(403, "Forbidden");
        }
        return { mode: "admin", requestUserId };
    }

    return { mode: "selfOrAdmin", requestUserId };
}

export function ensureArticleReadAccessForViewer(params: {
    boardReadAccess: BoardReadAccess;
    viewerContext: ViewerContext;
    postUserId: number;
}) {
    if (!canReadArticleForBoard(params.boardReadAccess, params.viewerContext, params.postUserId)) {
        throw new HttpError(403, "Forbidden");
    }
}

export function resolveArticleShowMutationFlags(params: {
    boardSlug: string;
    viewerContext: ViewerContext;
    postUserId: number;
}): { canEdit: boolean; canDelete: boolean } {
    const mutationPolicy = getArticleMutationPolicy(params.boardSlug);
    return {
        canEdit: canEditArticle(mutationPolicy, params.viewerContext, params.postUserId),
        canDelete: canDeleteArticle(mutationPolicy, params.viewerContext, params.postUserId),
    };
}

export function buildNeighborArticleQueryParams(params: {
    boardId: number;
    displayId: number;
    boardReadAccess: BoardReadAccess;
    viewerContext: ViewerContext;
}): { boardId: number; displayId: number; viewerUserId?: number } {
    const queryParams: { boardId: number; displayId: number; viewerUserId?: number } = {
        boardId: params.boardId,
        displayId: params.displayId,
    };
    // owner_or_admin 보드는 비관리자 조회 시 "내 글만" 탐색하도록 viewerUserId를 포함합니다.
    if (params.boardReadAccess === "owner_or_admin" && !params.viewerContext.isAdmin) {
        queryParams.viewerUserId = requireAuthenticatedViewerId(params.viewerContext);
    }
    return queryParams;
}

export function requireAuthenticatedViewerId(viewerContext: ViewerContext): number {
    if (!viewerContext.isAuthenticated || !Number.isFinite(viewerContext.viewerUserId) || viewerContext.viewerUserId <= 0) {
        throw new HttpError(401, "Unauthorized");
    }
    return viewerContext.viewerUserId;
}

export function readArticleFormInput(req: Request): ArticleFormInput {
    const parsed = parseArticleForm(req.body ?? {});
    if (parsed.success) {
        return {
            title: parsed.data.title,
            content: parsed.data.content,
        };
    }
    // 파싱 실패 시에도 사용자가 입력한 값을 최대한 유지해 폼 재표시에 활용합니다.
    return {
        title: String(req.body?.title ?? "").trim(),
        content: String(req.body?.content ?? "").trim(),
    };
}

export function renderArticleCreateForm(params: {
    res: Response;
    board: Pick<BoardMeta, "slug" | "name">;
    formError: string | null;
    title?: string;
    content?: string;
    status?: number;
}) {
    if (typeof params.status === "number") {
        params.res.status(params.status);
    }
    return params.res.render("board/new", buildArticleCreateFormViewModel({
        boardSlug: params.board.slug,
        boardDisplayName: params.board.name,
        formError: params.formError,
        ...(params.title === undefined ? {} : { title: params.title }),
        ...(params.content === undefined ? {} : { content: params.content }),
    }));
}

export function renderArticleEditForm(params: {
    res: Response;
    post: Pick<ArticleRecord, "boardSlug" | "boardName" | "displayId" | "imageUrl" | "fileUrl">;
    title: string;
    content: string;
    formError: string | null;
    status?: number;
}) {
    if (typeof params.status === "number") {
        params.res.status(params.status);
    }
    return params.res.render("board/edit", buildArticleEditFormViewModel({
        post: params.post,
        title: params.title,
        content: params.content,
        formError: params.formError,
    }));
}
