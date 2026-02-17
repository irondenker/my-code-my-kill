import path from "node:path";
import type { ArticleRecord } from "../types/article.types.js";
import { ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH, ARTICLE_IMAGE_PUBLIC_BASE_PATH } from "../constants/upload-article.constants.js";
import { isValidArticleContent, isValidArticleTitle } from "./article-validation.util.js";
import { buildMediaUrl } from "./media-url.util.js";

export type ArticleFormInput = {
    title: string;
    content: string;
};

export type ArticleFormValidationError = {
    status: 400 | 422;
    message: string;
};

export function validateArticleFormInput(input: ArticleFormInput): ArticleFormValidationError | null {
    if (!input.title || !input.content) {
        return { status: 400, message: "Title and content are required." };
    }
    if (!isValidArticleTitle(input.title) || !isValidArticleContent(input.content)) {
        return { status: 422, message: "Title or content is invalid." };
    }
    return null;
}

export function buildArticleCreateFormViewModel(params: {
    boardSlug: string;
    boardDisplayName: string;
    formError: string | null;
    title?: string;
    content?: string;
}) {
    return {
        boardSlug: params.boardSlug,
        boardDisplayName: params.boardDisplayName,
        formError: params.formError,
        ...(params.title === undefined ? {} : { title: params.title }),
        ...(params.content === undefined ? {} : { content: params.content }),
    };
}

export function buildArticleEditFormViewModel(params: {
    post: Pick<ArticleRecord, "boardSlug" | "boardName" | "displayId" | "imageUrl" | "fileUrl">;
    title: string;
    content: string;
    formError: string | null;
}) {
    return {
        boardSlug: params.post.boardSlug,
        boardDisplayName: params.post.boardName,
        displayId: params.post.displayId,
        title: params.title,
        content: params.content,
        imageUrl: buildMediaUrl(params.post.imageUrl, ARTICLE_IMAGE_PUBLIC_BASE_PATH),
        imageName: params.post.imageUrl ? path.basename(params.post.imageUrl) : null,
        fileUrl: buildMediaUrl(params.post.fileUrl, ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH),
        fileName: params.post.fileUrl ? path.basename(params.post.fileUrl) : null,
        formError: params.formError,
    };
}
