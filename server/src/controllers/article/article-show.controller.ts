import type { Request, Response } from "express";
import { HttpError } from "../../utils/http/http-error.js";
import { getPositiveIntParamOrThrow, getStringParamOrThrow } from "../../utils/http/route-param.util.js";
import {
    buildNeighborArticleQueryParams,
    ensureArticleReadAccessForViewer,
    ensureBoardReadAccess,
    resolveArticleShowMutationFlags,
} from "./article.controller.helpers.js";
import { findBoardBySlug } from "../../services/board.service.js";
import { findArticleForShowBySlugDisplayId, findNeighborArticles } from "../../services/article.service.js";

async function requireBoardBySlug(slug: string) {
    const board = await findBoardBySlug(slug);
    if (!board) {
        throw new HttpError(404, "Not Found");
    }
    return board;
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
