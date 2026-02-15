/**
 * 게시글 미디어(이미지/첨부파일) URL 유틸입니다.
 *
 * - DB에는 파일명 또는 상대 경로가 저장될 수 있습니다.
 * - 뷰에서 사용할 public URL(`/uploads/...`)로 정규화합니다.
 */

/**
 * 게시글 이미지 URL을 public 경로로 정규화합니다.
 *
 * @param value DB에 저장된 값(파일명 또는 경로)
 */
export function buildPostImageUrl(value: string | null): string | null {
    if (!value) {
        return null;
    }
    return value.startsWith("/") ? value : `/uploads/posts/images/${value}`;
}

/**
 * 게시글 첨부파일 URL을 public 경로로 정규화합니다.
 *
 * @param value DB에 저장된 값(파일명 또는 경로)
 */
export function buildPostFileUrl(value: string | null): string | null {
    if (!value) {
        return null;
    }
    return value.startsWith("/") ? value : `/uploads/posts/files/${value}`;
}

