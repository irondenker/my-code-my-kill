import path from "node:path";

export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_DIMENSION = 2048;
export const MIN_DIMENSION = 128;
export const OUTPUT_SIZE = 512;
export const OUTPUT_QUALITY = 80;
export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");