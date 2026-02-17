import type { Request, Response } from "express";
import { HttpError } from "../../utils/http-error.js";
import { getPositiveIntParamOrThrow, getStringParamOrThrow } from "../../utils/route-param.util.js";
import { validateArticleFormInput } from "../../utils/article-form.util.js";
import {
    ensurePostEditAccess,
    getUploadedFile,
    readArticleFormInput,
    renderArticleEditForm,
} from "./article.controller.helpers.js";
import {
    ArticleUploadError,
    findArticleBySlugDisplayId,
    updateArticleWithUploads,
} from "../../services/article.service.js";

async function requirePostBySlugDisplayId(params: { slug: string; displayId: number }) {
    const post = await findArticleBySlugDisplayId(params);
    if (!post) {
        throw new HttpError(404, "Not Found");
    }
    return post;
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
