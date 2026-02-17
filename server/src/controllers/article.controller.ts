import type { Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";
import { buildViewerContext } from "../utils/board.policy.util.js";
import {
    canDeleteArticle,
    canEditArticle,
    canReadArticleForBoard,
    getArticleMutationPolicy,
} from "../utils/article.policy.util.js";
import { getPositiveIntParamOrThrow, getStringParamOrThrow } from "../utils/route-param.util.js";
import { validateArticleFormInput } from "../utils/article-form.util.js";
import {
    ensureBoardCreateAccess,
    ensureBoardReadAccess,
    ensurePostEditAccess,
    getUploadedFile,
    readArticleFormInput,
    renderArticleCreateForm,
    renderArticleEditForm,
    requireAuthenticatedViewerId,
} from "./article.controller.helpers.js";
import { findBoardBySlug } from "../services/board.service.js";
import {
    ArticleUploadError,
    createArticleWithUploads,
    doesArticleExistBySlugDisplayId,
    findArticleBySlugDisplayId,
    findArticleForShowBySlugDisplayId,
    findNeighborArticles,
    softDeleteArticleBySlugDisplayId,
    softDeleteArticleBySlugDisplayIdAsAdmin,
    updateArticleWithUploads,
} from "../services/article.service.js";

/**
 * 게시글 컨트롤러입니다.
 *
 * 원칙:
 * - HTTP 흐름(req/res/redirect/render)만 담당합니다.
 * - 접근제어/폼검증/폼 렌더 모델 구성은 `article.controller.helpers`로 위임합니다.
 */

async function requireBoardBySlug(slug: string) {
    const board = await findBoardBySlug(slug);
    if (!board) {
        throw new HttpError(404, "Not Found");
    }
    return board;
}

async function requirePostBySlugDisplayId(params: { slug: string; displayId: number }) {
    const post = await findArticleBySlugDisplayId(params);
    if (!post) {
        throw new HttpError(404, "Not Found");
    }
    return post;
}

export async function getArticleCreateForm(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const board = await requireBoardBySlug(slug);

    ensureBoardCreateAccess(req, board);

    return renderArticleCreateForm({
        res,
        board,
        formError: null,
    });
}

export async function postArticleCreate(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const board = await requireBoardBySlug(slug);

    const viewerContext = ensureBoardCreateAccess(req, board);
    const userId = requireAuthenticatedViewerId(viewerContext);

    const input = readArticleFormInput(req);
    const validationError = validateArticleFormInput(input);
    if (validationError) {
        return renderArticleCreateForm({
            res,
            board,
            status: validationError.status,
            formError: validationError.message,
            title: input.title,
            content: input.content,
        });
    }

    const imageFile = getUploadedFile(req, "image");
    const attachmentFile = getUploadedFile(req, "attachment");

    let created: { displayId: number };
    try {
        created = await createArticleWithUploads({
            boardId: board.boardId,
            userId,
            title: input.title,
            content: input.content,
            imageFile,
            attachmentFile,
        });
    } catch (err) {
        if (!(err instanceof ArticleUploadError)) {
            throw err;
        }
        return renderArticleCreateForm({
            res,
            board,
            status: 422,
            formError: err.message,
            title: input.title,
            content: input.content,
        });
    }

    return res.redirect(`/board/${board.slug}/${created.displayId}`);
}

export async function getArticleEditForm(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");
    const post = await requirePostBySlugDisplayId({ slug, displayId });

    ensurePostEditAccess(req, post);

    return renderArticleEditForm({
        res,
        post,
        title: post.title,
        content: post.content,
        formError: null,
    });
}

export async function postArticleEdit(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");
    const post = await requirePostBySlugDisplayId({ slug, displayId });

    ensurePostEditAccess(req, post);

    const input = readArticleFormInput(req);
    const validationError = validateArticleFormInput(input);
    if (validationError) {
        return renderArticleEditForm({
            res,
            post,
            status: validationError.status,
            formError: validationError.message,
            title: input.title,
            content: input.content,
        });
    }

    const imageFile = getUploadedFile(req, "image");
    const attachmentFile = getUploadedFile(req, "attachment");

    let updated: boolean;
    try {
        updated = await updateArticleWithUploads({
            postId: post.postId,
            title: input.title,
            content: input.content,
            currentImageUrl: post.imageUrl,
            currentFileUrl: post.fileUrl,
            imageFile,
            attachmentFile,
        });
    } catch (err) {
        if (!(err instanceof ArticleUploadError)) {
            throw err;
        }
        return renderArticleEditForm({
            res,
            post,
            status: 422,
            formError: err.message,
            title: input.title,
            content: input.content,
        });
    }

    if (!updated) {
        throw new HttpError(404, "Not Found");
    }

    return res.redirect(`/board/${post.boardSlug}/${post.displayId}`);
}

export async function deleteArticle(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");

    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const requestUserId = requireAuthenticatedViewerId(viewerContext);

    const policy = getArticleMutationPolicy(slug);
    let deleted = false;

    if (policy.delete === "admin") {
        if (!viewerContext.isAdmin) {
            throw new HttpError(403, "Forbidden");
        }
        deleted = await softDeleteArticleBySlugDisplayIdAsAdmin({ slug, displayId });
    } else {
        deleted = await softDeleteArticleBySlugDisplayId({
            slug,
            displayId,
            requestUserId,
        });
    }

    if (deleted) {
        if (req.method === "POST") {
            req.session.boardFlashMessage = "Article has been deleted.";
            return res.redirect(`/board/${encodeURIComponent(slug)}`);
        }
        return res.status(204).send();
    }

    const exists = await doesArticleExistBySlugDisplayId({ slug, displayId });
    if (!exists) {
        throw new HttpError(404, "Not Found");
    }
    throw new HttpError(403, "Forbidden");
}

export async function getArticleShow(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");

    const board = await requireBoardBySlug(slug);
    const viewerContext = ensureBoardReadAccess(req, board);
    const post = await findArticleForShowBySlugDisplayId({ slug, displayId });
    if (!post) {
        throw new HttpError(404, "Not Found");
    }

    if (!canReadArticleForBoard(board.readAccess, viewerContext, post.user_id)) {
        throw new HttpError(403, "Forbidden");
    }

    const mutationPolicy = getArticleMutationPolicy(slug);
    const canEdit = canEditArticle(mutationPolicy, viewerContext, post.user_id);
    const canDelete = canDeleteArticle(mutationPolicy, viewerContext, post.user_id);

    const neighborParams: { boardId: number; displayId: number; viewerUserId?: number } = {
        boardId: post.board_id,
        displayId,
    };
    if (board.readAccess === "owner_or_admin" && !viewerContext.isAdmin) {
        neighborParams.viewerUserId = requireAuthenticatedViewerId(viewerContext);
    }
    const { prevPost, nextPost } = await findNeighborArticles(neighborParams);

    return res.render("board/show", {
        post,
        prevPost,
        nextPost,
        boardSlug: slug,
        canEdit,
        canDelete,
    });
}
