import type { Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";
import { getPositiveIntParamOrThrow, getStringParamOrThrow } from "../utils/route-param.util.js";
import { validateArticleFormInput } from "../utils/article-form.util.js";
import {
    buildNeighborArticleQueryParams,
    ensureArticleReadAccessForViewer,
    ensureBoardCreateAccess,
    ensureBoardReadAccess,
    ensurePostEditAccess,
    getUploadedFile,
    readArticleFormInput,
    renderArticleCreateForm,
    renderArticleEditForm,
    resolveArticleDeletePlan,
    resolveArticleShowMutationFlags,
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
import { setSessionFlashMessage } from "../utils/session-flash.util.js";

/**
 * 게시글 컨트롤러입니다.
 *
 * 원칙:
 * - HTTP 흐름(req/res/redirect/render)만 담당합니다.
 * - 접근제어/입력 파싱/폼 렌더 모델 구성은 `article.controller.helpers`로 위임합니다.
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
        // 업로드 검증 실패는 도메인 예외를 422 폼 에러로 변환해 사용자 입력을 보존합니다.
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
        // 수정 흐름도 생성과 동일하게 업로드 관련 오류만 422로 노출합니다.
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
    // 보드 정책에 따라 "관리자 전용 삭제"와 "작성자/관리자 삭제" 경로를 분리합니다.
    const deletePlan = resolveArticleDeletePlan(req, slug);
    let deleted = false;

    if (deletePlan.mode === "admin") {
        deleted = await softDeleteArticleBySlugDisplayIdAsAdmin({ slug, displayId });
    } else {
        deleted = await softDeleteArticleBySlugDisplayId({
            slug,
            displayId,
            requestUserId: deletePlan.requestUserId,
        });
    }

    if (deleted) {
        // HTML 폼(POST) 요청은 UX를 위해 보드 목록으로 리다이렉트하고,
        // API 스타일 요청(DELETE)은 본문 없이 204로 종료합니다.
        if (req.method === "POST") {
            setSessionFlashMessage(req, "boardFlashMessage", "Article has been deleted.");
            return res.redirect(`/board/${encodeURIComponent(slug)}`);
        }
        return res.status(204).send();
    }

    // 삭제 실패 시 존재 여부를 재확인해 404(대상 없음)와 403(권한 부족)을 구분합니다.
    const exists = await doesArticleExistBySlugDisplayId({ slug, displayId });
    if (!exists) {
        throw new HttpError(404, "Not Found");
    }
    throw new HttpError(403, "Forbidden");
}

export async function getArticleShow(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");

    // 1) 보드 자체 접근권한을 먼저 확인합니다.
    const board = await requireBoardBySlug(slug);
    const viewerContext = ensureBoardReadAccess(req, board);

    // 2) 게시글을 조회한 뒤, owner_or_admin 정책은 게시글 작성자 기준으로 추가 판정합니다.
    const post = await findArticleForShowBySlugDisplayId({ slug, displayId });
    if (!post) {
        throw new HttpError(404, "Not Found");
    }

    ensureArticleReadAccessForViewer({
        boardReadAccess: board.readAccess,
        viewerContext,
        postUserId: post.user_id,
    });
    const { canEdit, canDelete } = resolveArticleShowMutationFlags({
        boardSlug: slug,
        viewerContext,
        postUserId: post.user_id,
    });

    // 3) 이전/다음 글 조회는 동일 접근정책을 공유하도록 helper가 쿼리 파라미터를 조립합니다.
    const neighborParams = buildNeighborArticleQueryParams({
        boardId: post.board_id,
        displayId,
        boardReadAccess: board.readAccess,
        viewerContext,
    });
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
