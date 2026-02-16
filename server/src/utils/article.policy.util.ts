import type { BoardReadAccess, ViewerContext } from "../types/board.types.js";
import type { ArticleMutationPolicy } from "../types/article.types.js";

/**
 * 게시글(Article) 접근 정책 유틸입니다.
 *
 * 원칙:
 * - 이 파일은 "순수 판정/계산"만 담당합니다(HTTP/DB/파일 I/O 없음).
 * - 컨트롤러는 세션/요청 값을 읽어와 여기로 전달합니다.
 */

export type { ArticleMutationPolicy } from "../types/article.types.js";

/**
 * 보드 slug에 따른 "게시글 변경 정책(수정/삭제)"을 결정합니다.
 * (예: 공지 보드는 수정/삭제가 admin만 가능)
 *
 * @param slug 보드 slug
 */
export function getArticleMutationPolicy(slug: string): ArticleMutationPolicy {
    if (slug === "announcement") {
        return { update: "admin", delete: "admin" };
    }
    return { update: "self", delete: "selfOrAdmin" };
}

/**
 * readAccess가 owner_or_admin인 경우, 특정 게시글(postUserId)을 읽을 수 있는지 판정합니다.
 *
 * @param readAccess 보드 readAccess
 * @param context viewer 컨텍스트
 * @param postUserId 게시글 작성자 userId
 */
export function canReadArticleForBoard(readAccess: BoardReadAccess, context: ViewerContext, postUserId: number): boolean {
    if (readAccess !== "owner_or_admin") {
        return true;
    }
    return context.isAdmin || context.viewerUserId === postUserId;
}

/**
 * 게시글 수정 가능 여부를 판정합니다.
 *
 * @param policy 게시글 변경 정책(수정)
 * @param context viewer 컨텍스트
 * @param postUserId 게시글 작성자 userId
 */
export function canEditArticle(policy: ArticleMutationPolicy, context: ViewerContext, postUserId: number): boolean {
    const isOwner = context.viewerUserId === postUserId;
    return policy.update === "admin" ? context.isAdmin : isOwner;
}

/**
 * 게시글 삭제 가능 여부를 판정합니다.
 *
 * @param policy 게시글 변경 정책(삭제)
 * @param context viewer 컨텍스트
 * @param postUserId 게시글 작성자 userId
 */
export function canDeleteArticle(policy: ArticleMutationPolicy, context: ViewerContext, postUserId: number): boolean {
    const isOwner = context.viewerUserId === postUserId;
    return policy.delete === "admin" ? context.isAdmin : isOwner || context.isAdmin;
}
