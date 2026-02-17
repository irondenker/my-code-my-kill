import type { Request, Response } from "express";
import { HttpError } from "../../utils/http-error.js";
import { getStringParamOrThrow } from "../../utils/route-param.util.js";
import { validateArticleFormInput } from "../../utils/article-form.util.js";
import {
    ensureBoardCreateAccess,
    getUploadedFile,
    readArticleFormInput,
    renderArticleCreateForm,
    requireAuthenticatedViewerId,
} from "../article.controller.helpers.js";
import { findBoardBySlug } from "../../services/board.service.js";
import {
    ArticleUploadError,
    createArticleWithUploads,
} from "../../services/article.service.js";

async function requireBoardBySlug(slug: string) {
    const board = await findBoardBySlug(slug);
    if (!board) {
        throw new HttpError(404, "Not Found");
    }
    return board;
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
