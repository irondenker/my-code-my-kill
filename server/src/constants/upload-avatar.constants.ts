import path from 'node:path';

/**
 * 업로드(아바타) 관련 상수 모음입니다.
 *
 * 주의:
 * - 서버는 업로드 파일의 확장자/Content-Type을 신뢰하지 않습니다.
 * - 실제 바이너리 검증(매직넘버)은 옵션에 의해 활성화됩니다.
 */

/**
 * 허용하는 이미지 MIME 타입 목록입니다.
 * (1차 필터링 용도이며, 매직넘버 검증이 켜져 있으면 추가 검증을 수행합니다.)
 */
export const AVATAR_IMAGE_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * 아바타 업로드 최대 허용 크기(bytes)입니다.
 */
export const AVATAR_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * 입력 이미지의 최대 가로/세로 픽셀입니다.
 * sharp 디코딩 비용을 제어하기 위한 제한입니다.
 */
export const AVATAR_IMAGE_MAX_DIMENSION = 2048;

/**
 * 입력 이미지의 최소 가로/세로 픽셀입니다.
 * 너무 작은 이미지는 품질이 크게 떨어지므로 제한합니다.
 */
export const AVATAR_IMAGE_MIN_DIMENSION = 128;

/**
 * 저장할 아바타 출력 크기(정사각형 한 변, px)입니다.
 */
export const AVATAR_IMAGE_OUTPUT_SIZE = 512;

/**
 * webp 출력 품질(0-100)입니다.
 */
export const AVATAR_IMAGE_OUTPUT_QUALITY = 80;

/**
 * 업로드된 아바타 파일이 저장될 디스크 경로입니다.
 * public 정적 경로 하위로 저장되어 `/uploads/avatars/...` 로 접근됩니다.
 */
export const AVATAR_IMAGE_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');
