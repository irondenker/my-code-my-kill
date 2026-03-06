/**
 * 게시글 미디어(이미지/첨부파일) URL 유틸입니다.
 *
 * - DB에는 파일명 또는 상대 경로가 저장될 수 있습니다.
 * - 뷰에서 사용할 public URL(`/uploads/...`)로 정규화합니다.
 */

/**
 * 미디어 값을 public 경로로 정규화합니다.
 * 이미 절대 경로(`/...`)면 그대로 사용하고, 파일명이면 basePath를 붙입니다.
 *
 * @param value DB에 저장된 값(파일명 또는 경로)
 * @param basePath 파일명일 때 붙일 public base 경로
 */
export function buildMediaUrl(value: string | null, basePath: string): string | null {
  if (!value) {
    return null;
  }
  return value.startsWith('/') ? value : `${basePath}/${value}`;
}
