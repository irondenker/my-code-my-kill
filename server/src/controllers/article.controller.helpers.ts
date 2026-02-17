import type { Request, Response } from "express";
import type { ArticleRecord } from "../types/article.types.js";
import type { BoardMeta, ViewerContext } from "../types/board.types.js";
import { HttpError } from "../utils/http-error.js";
import {
    buildViewerContext,
    getBoardCreateAccessResult,
    getBoardReadAccessResult,
} from "../utils/board.policy.util.js";
import { canEditArticle, getArticleMutationPolicy } from "../utils/article.policy.util.js";
import {
    type ArticleFormInput,
    buildArticleCreateFormViewModel,
    buildArticleEditFormViewModel,
} from "../utils/article-form.util.js";

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

export function requireAuthenticatedViewerId(viewerContext: ViewerContext): number {
    if (!viewerContext.isAuthenticated || !Number.isFinite(viewerContext.viewerUserId) || viewerContext.viewerUserId <= 0) {
        throw new HttpError(401, "Unauthorized");
    }
    return viewerContext.viewerUserId;
}

export function readArticleFormInput(req: Request): ArticleFormInput {
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
