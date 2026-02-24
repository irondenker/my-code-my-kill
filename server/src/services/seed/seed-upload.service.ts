import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
    ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH,
    ARTICLE_ATTACHMENT_UPLOAD_DIR,
    ARTICLE_IMAGE_PUBLIC_BASE_PATH,
    ARTICLE_IMAGE_UPLOAD_DIR,
} from "../../constants/upload-article.constants.js";
import { AVATAR_IMAGE_UPLOAD_DIR } from "../../constants/upload-avatar.constants.js";
import { storeArticleAttachment, storeArticleImage } from "../article/article-upload.service.js";

type SeedUploadKind = "avatar" | "post-image" | "attachment";

export type SeedStoredUpload = {
    entityId: number;
    kind: SeedUploadKind;
    originalPath: string;
    storedFilename: string;
    storedPath: string;
    storedRelativePath: string;
    publicPath: string;
};

const MIME_BY_EXTENSION = new Map<string, string>([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".webp", "image/webp"],
    [".pdf", "application/pdf"],
    [".txt", "text/plain"],
    [".csv", "text/csv"],
    [".zip", "application/zip"],
]);

function toPosixRelative(basePath: string, filename: string): string {
    const normalizedBase = basePath.replace(/^\/+/, "");
    return path.posix.join(normalizedBase, filename);
}

async function toMulterFileFromPath(rawPath: string, fieldname: string): Promise<Express.Multer.File> {
    const absolutePath = path.resolve(rawPath);
    const originalname = path.basename(absolutePath);
    const extension = path.extname(originalname).toLowerCase();
    const mimetype = MIME_BY_EXTENSION.get(extension) ?? "application/octet-stream";
    const buffer = await fs.readFile(absolutePath);

    return {
        fieldname,
        originalname,
        encoding: "7bit",
        mimetype,
        size: buffer.length,
        destination: "",
        filename: "",
        path: absolutePath,
        buffer,
        stream: Readable.from(buffer),
    };
}

export async function uploadProfileImageFromPath(userId: number, rawPath: string): Promise<SeedStoredUpload> {
    const { uploadProfileImageFromFile } = await import("../profile/profile-avatar-upload.service.js");
    const file = await toMulterFileFromPath(rawPath, "avatar");
    const stored = await uploadProfileImageFromFile({ userId, file });
    const storedRelativePath = toPosixRelative("/uploads/avatars", stored.storedFilename);
    return {
        entityId: userId,
        kind: "avatar",
        originalPath: path.resolve(rawPath),
        storedFilename: stored.storedFilename,
        storedPath: path.join(AVATAR_IMAGE_UPLOAD_DIR, stored.storedFilename),
        storedRelativePath,
        publicPath: `/${storedRelativePath}`,
    };
}

export async function uploadPostImageFromPath(postId: number, rawPath: string): Promise<SeedStoredUpload> {
    const file = await toMulterFileFromPath(rawPath, "image");
    const storedFilename = await storeArticleImage(file);
    const storedRelativePath = toPosixRelative(ARTICLE_IMAGE_PUBLIC_BASE_PATH, storedFilename);
    return {
        entityId: postId,
        kind: "post-image",
        originalPath: path.resolve(rawPath),
        storedFilename,
        storedPath: path.join(ARTICLE_IMAGE_UPLOAD_DIR, storedFilename),
        storedRelativePath,
        publicPath: `/${storedRelativePath}`,
    };
}

export async function uploadAttachmentFromPath(postId: number, rawPath: string): Promise<SeedStoredUpload> {
    const file = await toMulterFileFromPath(rawPath, "attachment");
    const storedFilename = await storeArticleAttachment(file);
    const storedRelativePath = toPosixRelative(ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH, storedFilename);
    return {
        entityId: postId,
        kind: "attachment",
        originalPath: path.resolve(rawPath),
        storedFilename,
        storedPath: path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, storedFilename),
        storedRelativePath,
        publicPath: `/${storedRelativePath}`,
    };
}
