import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ensureDir, safeUnlink } from "../../utils/fs.util.js";
import {
    isExtensionCheckEnabled,
    isMagicNumberCheckEnabled,
    resolveAttachmentExpectation,
    validateAllowedExtension,
    validateMagicNumberForAttachment,
    validateMagicNumberForImage,
} from "../../utils/upload-validation.util.js";
import {
    POST_ATTACHMENT_EXTENSIONS,
    POST_ATTACHMENT_MAX_BYTES,
    POST_ATTACHMENT_ALLOWED_MIME_TYPES,
    POST_ATTACHMENT_UPLOAD_DIR,
    POST_IMAGE_ALLOWED_MIME_TYPES,
    POST_IMAGE_MAX_BYTES,
    POST_IMAGE_MAX_DIMENSION,
    POST_IMAGE_MAX_OUTPUT_WIDTH,
    POST_IMAGE_OUTPUT_QUALITY,
    POST_IMAGE_UPLOAD_DIR,
} from "../../constants/upload-post.constants.js";

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
async function ensurePostUploadDirs(): Promise<void> {
    await Promise.all([ensureDir(POST_IMAGE_UPLOAD_DIR), ensureDir(POST_ATTACHMENT_UPLOAD_DIR)]);
}

/**
 * 업로드 파일명을 생성합니다.
 * timestamp + random suffix로 충돌 가능성을 낮춥니다.
 *
 * @param prefix 파일 용도 prefix(예: post-image)
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
export async function storePostImage(file: Express.Multer.File): Promise<string> {
    if (isMagicNumberCheckEnabled()) {
        validateMagicNumberForImage(file.buffer);
    }
    if (!POST_IMAGE_ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new Error("Unsupported image type.");
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
        throw new Error("Image file is too large.");
    }

    const image = sharp(file.buffer, {
        limitInputPixels: POST_IMAGE_MAX_DIMENSION * POST_IMAGE_MAX_DIMENSION,
    });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
        throw new Error("Invalid image data.");
    }
    if (width > POST_IMAGE_MAX_DIMENSION || height > POST_IMAGE_MAX_DIMENSION) {
        throw new Error("Image dimensions exceed the limit.");
    }

    await ensurePostUploadDirs();
    const filename = createUploadName("post-image", ".webp");
    const outputPath = path.join(POST_IMAGE_UPLOAD_DIR, filename);

    await image
        .resize(POST_IMAGE_MAX_OUTPUT_WIDTH, POST_IMAGE_MAX_OUTPUT_WIDTH, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: POST_IMAGE_OUTPUT_QUALITY })
        .toFile(outputPath);

    return filename;
}

/**
 * 게시글 첨부파일을 저장하고 파일명을 반환합니다.
 *
 * @throws 검증 실패 시 Error(message)
 */
export async function storePostAttachment(file: Express.Multer.File): Promise<string> {
    if (!POST_ATTACHMENT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new Error("Unsupported attachment type.");
    }
    if (file.size > POST_ATTACHMENT_MAX_BYTES) {
        throw new Error("Attachment file is too large.");
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (isExtensionCheckEnabled()) {
        validateAllowedExtension(file.originalname, POST_ATTACHMENT_EXTENSIONS);
    }
    if (isMagicNumberCheckEnabled()) {
        const expectation = resolveAttachmentExpectation({
            extension,
            mimetype: file.mimetype,
            trustExtension: isExtensionCheckEnabled(),
        });
        if (!expectation) {
            throw new Error("Unsupported attachment type.");
        }
        validateMagicNumberForAttachment(file.buffer, expectation);
    }

    await ensurePostUploadDirs();
    const filename = createUploadName("post-file", extension);
    const outputPath = path.join(POST_ATTACHMENT_UPLOAD_DIR, filename);
    await fs.writeFile(outputPath, file.buffer);

    return filename;
}

/**
 * 저장된 게시글 이미지 파일을 삭제합니다(best-effort).
 *
 * @param filename DB에 저장된 파일명
 */
export async function deleteStoredPostImage(filename: string | null): Promise<void> {
    if (!filename) {
        return;
    }
    await safeUnlink(path.join(POST_IMAGE_UPLOAD_DIR, path.basename(filename)));
}

/**
 * 저장된 게시글 첨부파일을 삭제합니다(best-effort).
 *
 * @param filename DB에 저장된 파일명
 */
export async function deleteStoredPostAttachment(filename: string | null): Promise<void> {
    if (!filename) {
        return;
    }
    await safeUnlink(path.join(POST_ATTACHMENT_UPLOAD_DIR, path.basename(filename)));
}
