/**
 * 게시글 입력 검증 유틸입니다.
 *
 * 원칙:
 * - I/O(req/res/session) 없이 동작하는 순수 함수만 둡니다.
 * - 보드 정책/권한 판정과 분리해 "게시글 입력값 검증"만 담당합니다.
 */

/**
 * 게시글 제목 길이를 검증합니다.
 *
 * @param title 게시글 제목
 */
export function isValidArticleTitle(title: string): boolean {
    return title.length >= 2 && title.length <= 255;
}

/**
 * 게시글 본문 길이를 검증합니다.
 *
 * @param content 게시글 본문
 */
export function isValidArticleContent(content: string): boolean {
    return content.length >= 2 && content.length <= 10_000;
}
