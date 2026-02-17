import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./article-write.lab.service.js";
import * as normalImplementation from "./article-write.normal.service.js";
import {
    deleteStoredArticleAttachment,
    deleteStoredArticleImage,
    storeArticleAttachment,
    storeArticleImage,
} from "./article-upload.service.js";

/**
 * 게시글 쓰기/수정/삭제 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `article-write.lab.service`를 사용합니다.
 * - 그 외 기능은 `article-write.normal.service`를 사용합니다.
 */

type StoredUploads = {
    imageUrl: string | null;
    fileUrl: string | null;
};

/**
 * 업로드 검증/저장 단계에서 발생한 사용자 노출 가능 에러입니다.
 */
export class ArticleUploadError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "ArticleUploadError";
    }
}

/**
 * 저장된 업로드 파일을 best-effort로 정리합니다.
 */
async function cleanupArticleUploads(uploads: StoredUploads): Promise<void> {
    await Promise.all([
        deleteStoredArticleImage(uploads.imageUrl),
        deleteStoredArticleAttachment(uploads.fileUrl),
    ]);
}

/**
 * 업로드 파일을 저장하고 저장 결과(파일명)를 반환합니다.
 * 저장 중 실패하면 이미 저장된 파일은 즉시 정리합니다.
 */
async function storeArticleUploads(params: {
    imageFile: Express.Multer.File | null | undefined;
    attachmentFile: Express.Multer.File | null | undefined;
}): Promise<StoredUploads> {
    let imageUrl: string | null = null;
    let fileUrl: string | null = null;

    try {
        if (params.imageFile) {
            imageUrl = await storeArticleImage(params.imageFile);
        }
        if (params.attachmentFile) {
            fileUrl = await storeArticleAttachment(params.attachmentFile);
        }
        return { imageUrl, fileUrl };
    } catch (err) {
        await cleanupArticleUploads({ imageUrl, fileUrl });
        const message = err instanceof Error ? err.message : "Invalid upload.";
        throw new ArticleUploadError(message, { cause: err });
    }
}

/**
 * 게시글을 생성합니다.
 */
export async function createArticle(params: {
    boardId: number;
    userId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<{ displayId: number }> {
    if (isSqlInjectionTargetEnabled("postCreate")) {
        return labImplementation.createArticle(params);
    }
    return normalImplementation.createArticle(params);
}

/**
 * 게시글 내용을 수정합니다.
 */
export async function updateArticle(params: {
    postId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<boolean> {
    if (isSqlInjectionTargetEnabled("postUpdate")) {
        return labImplementation.updateArticle(params);
    }
    return normalImplementation.updateArticle(params);
}

/**
 * 관리자 권한으로 게시글을 soft delete 합니다.
 */
export async function softDeleteArticleBySlugDisplayIdAsAdmin(params: { slug: string; displayId: number }): Promise<boolean> {
    if (isSqlInjectionTargetEnabled("postUpdate")) {
        return labImplementation.softDeleteArticleBySlugDisplayIdAsAdmin(params);
    }
    return normalImplementation.softDeleteArticleBySlugDisplayIdAsAdmin(params);
}

/**
 * 요청 사용자 권한을 반영해 게시글을 soft delete 합니다.
 */
export async function softDeleteArticleBySlugDisplayId(params: {
    slug: string;
    displayId: number;
    requestUserId: number;
}): Promise<boolean> {
    if (isSqlInjectionTargetEnabled("postUpdate")) {
        return labImplementation.softDeleteArticleBySlugDisplayId(params);
    }
    return normalImplementation.softDeleteArticleBySlugDisplayId(params);
}

/**
 * 게시글 생성 커맨드입니다.
 * 파일 업로드와 DB 생성을 하나의 작업 단위로 묶어 처리합니다.
 */
export async function createArticleWithUploads(params: {
    boardId: number;
    userId: number;
    title: string;
    content: string;
    imageFile?: Express.Multer.File | null;
    attachmentFile?: Express.Multer.File | null;
}): Promise<{ displayId: number }> {
    const uploads = await storeArticleUploads({
        imageFile: params.imageFile,
        attachmentFile: params.attachmentFile,
    });

    try {
        return await createArticle({
            boardId: params.boardId,
            userId: params.userId,
            title: params.title,
            content: params.content,
            imageUrl: uploads.imageUrl,
            fileUrl: uploads.fileUrl,
        });
    } catch (err) {
        await cleanupArticleUploads(uploads);
        throw err;
    }
}

/**
 * 게시글 수정 커맨드입니다.
 * 새 파일 업로드/DB 수정/기존 파일 정리를 순서대로 처리합니다.
 */
export async function updateArticleWithUploads(params: {
    postId: number;
    title: string;
    content: string;
    currentImageUrl?: string | null;
    currentFileUrl?: string | null;
    imageFile?: Express.Multer.File | null;
    attachmentFile?: Express.Multer.File | null;
}): Promise<boolean> {
    const uploads = await storeArticleUploads({
        imageFile: params.imageFile,
        attachmentFile: params.attachmentFile,
    });

    const imageUrl = uploads.imageUrl ?? params.currentImageUrl ?? null;
    const fileUrl = uploads.fileUrl ?? params.currentFileUrl ?? null;

    const updated = await updateArticle({
        postId: params.postId,
        title: params.title,
        content: params.content,
        imageUrl,
        fileUrl,
    });

    if (!updated) {
        await cleanupArticleUploads(uploads);
        return false;
    }

    if (uploads.imageUrl && params.currentImageUrl) {
        await deleteStoredArticleImage(params.currentImageUrl);
    }

    if (uploads.fileUrl && params.currentFileUrl) {
        await deleteStoredArticleAttachment(params.currentFileUrl);
    }

    return true;
}
