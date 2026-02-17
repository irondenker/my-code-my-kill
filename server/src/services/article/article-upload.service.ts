import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ensureDir, safeUnlink } from "../../utils/upload/fs.util.js";
import {
    isExtensionCheckEnabled,
    isMimeCheckEnabled,
    isMagicNumberCheckEnabled,
    resolveAttachmentExpectation,
    validateAllowedExtension,
    validateMagicNumberForAttachment,
    validateMagicNumberForImage,
} from "../../utils/upload/upload-validation.util.js";
import {
    ARTICLE_ATTACHMENT_EXTENSIONS,
    ARTICLE_ATTACHMENT_MAX_BYTES,
    ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES,
    ARTICLE_ATTACHMENT_UPLOAD_DIR,
    ARTICLE_IMAGE_ALLOWED_MIME_TYPES,
    ARTICLE_IMAGE_MAX_BYTES,
    ARTICLE_IMAGE_MAX_DIMENSION,
    ARTICLE_IMAGE_MAX_OUTPUT_WIDTH,
    ARTICLE_IMAGE_OUTPUT_QUALITY,
    ARTICLE_IMAGE_UPLOAD_DIR,
} from "../../constants/upload-article.constants.js";

/**
 * 게시글 업로드(이미지/첨부파일) 저장을 담당하는 서비스입니다.
 *
 * 책임:
 * - 업로드 파일 검증(크기/타입/옵션 기반 시그니처 검증)
 * - 디스크 저장(webp 변환 또는 원본 버퍼 저장)
 * - 저장된 파일 삭제(best-effort)
 *
 * 반대 책임(여기서 하지 않음):
 * - DB 업데이트는 `board.service` 등에서 처리합니다.
 * - 어떤 요청에서 업로드를 허용할지는 컨트롤러가 결정합니다.
 */

/**
 * 게시글 이미지/첨부 업로드 디렉토리를 보장합니다.
 * `recursive: true`로 idempotent하게 처리합니다.
 */
async function ensureArticleUploadDirs(): Promise<void> {
    await Promise.all([ensureDir(ARTICLE_IMAGE_UPLOAD_DIR), ensureDir(ARTICLE_ATTACHMENT_UPLOAD_DIR)]);
}

/**
 * 업로드 파일명을 생성합니다.
 * timestamp + random suffix로 충돌 가능성을 낮춥니다.
 *
 * @param prefix 파일 용도 prefix(예: article-image)
 * @param extension 파일 확장자(예: .webp, .pdf)
 */
function createUploadName(prefix: string, extension: string): string {
    const suffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    return `${prefix}-${suffix}${extension}`;
}

/**
 * 게시글 이미지 파일을 저장하고 파일명을 반환합니다.
 * 저장 포맷은 webp로 통일합니다.
 *
 * @throws 검증 실패 시 Error(message)
 */
export async function storeArticleImage(file: Express.Multer.File): Promise<string> {
    if (isMagicNumberCheckEnabled()) {
        validateMagicNumberForImage(file.buffer);
    }
    if (isMimeCheckEnabled() && !ARTICLE_IMAGE_ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new Error("Unsupported image type.");
    }
    if (file.size > ARTICLE_IMAGE_MAX_BYTES) {
        throw new Error("Image file is too large.");
    }

    const image = sharp(file.buffer, {
        limitInputPixels: ARTICLE_IMAGE_MAX_DIMENSION * ARTICLE_IMAGE_MAX_DIMENSION,
    });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
        throw new Error("Invalid image data.");
    }
    if (width > ARTICLE_IMAGE_MAX_DIMENSION || height > ARTICLE_IMAGE_MAX_DIMENSION) {
        throw new Error("Image dimensions exceed the limit.");
    }

    await ensureArticleUploadDirs();
    const filename = createUploadName("article-image", ".webp");
    const outputPath = path.join(ARTICLE_IMAGE_UPLOAD_DIR, filename);

    await image
        .resize(ARTICLE_IMAGE_MAX_OUTPUT_WIDTH, ARTICLE_IMAGE_MAX_OUTPUT_WIDTH, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: ARTICLE_IMAGE_OUTPUT_QUALITY })
        .toFile(outputPath);

    return filename;
}

/**
 * 게시글 첨부파일을 저장하고 파일명을 반환합니다.
 *
 * @throws 검증 실패 시 Error(message)
 */
export async function storeArticleAttachment(file: Express.Multer.File): Promise<string> {
    if (isMimeCheckEnabled() && !ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new Error("Unsupported attachment type.");
    }
    if (file.size > ARTICLE_ATTACHMENT_MAX_BYTES) {
        throw new Error("Attachment file is too large.");
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const extensionCheckEnabled = isExtensionCheckEnabled();
    const mimeCheckEnabled = isMimeCheckEnabled();
    const magicNumberCheckEnabled = isMagicNumberCheckEnabled();

    if (extensionCheckEnabled) {
        validateAllowedExtension(file.originalname, ARTICLE_ATTACHMENT_EXTENSIONS);
    }
    if (magicNumberCheckEnabled) {
        const expectation = resolveAttachmentExpectation({
            extension,
            mimetype: file.mimetype,
            trustExtension: extensionCheckEnabled,
            trustMime: mimeCheckEnabled,
        });
        if (!expectation) {
            throw new Error("Unsupported attachment type.");
        }
        validateMagicNumberForAttachment(file.buffer, expectation);
    }

    await ensureArticleUploadDirs();
    const filename = createUploadName("article-file", extension);
    const outputPath = path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, filename);
    await fs.writeFile(outputPath, file.buffer);

    return filename;
}

/**
 * 저장된 게시글 이미지 파일을 삭제합니다(best-effort).
 *
 * @param filename DB에 저장된 파일명
 */
export async function deleteStoredArticleImage(filename: string | null): Promise<void> {
    if (!filename) {
        return;
    }
    await safeUnlink(path.join(ARTICLE_IMAGE_UPLOAD_DIR, path.basename(filename)));
}

/**
 * 저장된 게시글 첨부파일을 삭제합니다(best-effort).
 *
 * @param filename DB에 저장된 파일명
 */
export async function deleteStoredArticleAttachment(filename: string | null): Promise<void> {
    if (!filename) {
        return;
    }
    await safeUnlink(path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, path.basename(filename)));
}
