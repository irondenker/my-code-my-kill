import path from "node:path";

/**
 * 게시글 업로드(이미지/첨부파일) 관련 상수 모음입니다.
 *
 * 주의:
 * - 서버는 확장자/Content-Type을 신뢰하지 않으며, 옵션에 따라 매직넘버 검증을 수행합니다.
 * - 이 상수는 컨트롤러/서비스에서 공통으로 사용할 수 있도록 분리했습니다.
 */

export const ARTICLE_IMAGE_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"]);

export const ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.ms-excel",
    "application/zip",
    "application/x-zip-compressed",
]);

export const ARTICLE_ATTACHMENT_EXTENSIONS: ReadonlySet<string> = new Set([".pdf", ".txt", ".csv", ".zip"]);

export const ARTICLE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const ARTICLE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * sharp 디코딩 비용 방지용 입력 최대 가로/세로 픽셀입니다.
 */
export const ARTICLE_IMAGE_MAX_DIMENSION = 5120;

export const ARTICLE_IMAGE_OUTPUT_QUALITY = 82;
export const ARTICLE_IMAGE_MAX_OUTPUT_WIDTH = 1280;

export const ARTICLE_IMAGE_PUBLIC_BASE_PATH = "/uploads/posts/images";
export const ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH = "/uploads/posts/files";

export const ARTICLE_IMAGE_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "posts", "images");
export const ARTICLE_ATTACHMENT_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "posts", "files");
