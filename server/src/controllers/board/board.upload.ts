import type { Request } from "express";

import {
    deleteStoredPostAttachment,
    deleteStoredPostImage,
    storePostAttachment,
    storePostImage,
} from "../../services/board.service.js";

/**
 * `multer.fields()`로 업로드된 파일 중, 특정 fieldName의 첫 번째 파일을 반환합니다.
 * 파일이 없으면 null을 반환합니다.
 */
function getUploadedFile(req: Request, fieldName: string): Express.Multer.File | null {
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

export type StoredUploads = {
    imageUrl: string | null;
    fileUrl: string | null;
};

/**
 * 요청에 포함된 업로드(image/attachment)를 저장합니다.
 *
 * - 저장 중 하나라도 실패하면, 이미 저장된 파일도 best-effort로 정리한 뒤 에러를 다시 던집니다.
 * - 성공 시 저장된 경로(또는 null)를 반환합니다.
 */
export async function storeBoardPostUploads(req: Request): Promise<StoredUploads> {
    const imageFile = getUploadedFile(req, "image");
    const attachmentFile = getUploadedFile(req, "attachment");
    let imageUrl: string | null = null;
    let fileUrl: string | null = null;

    try {
        if (imageFile) {
            imageUrl = await storePostImage(imageFile);
        }
        if (attachmentFile) {
            fileUrl = await storePostAttachment(attachmentFile);
        }
        return { imageUrl, fileUrl };
    } catch (err) {
        await cleanupBoardPostUploads({ imageUrl, fileUrl });
        throw err;
    }
}

/**
 * 저장된 업로드 파일을 best-effort로 정리합니다.
 * (파일이 null이거나 이미 삭제된 경우도 안전해야 합니다.)
 */
export async function cleanupBoardPostUploads(uploads: StoredUploads): Promise<void> {
    await Promise.all([deleteStoredPostImage(uploads.imageUrl), deleteStoredPostAttachment(uploads.fileUrl)]);
}

