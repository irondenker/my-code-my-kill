import type { BoardCreateAccess, BoardReadAccess, BoardMeta, BoardWritePolicy, ViewerContext } from "../types/board.types.js";

/**
 * 보드/게시글 접근 정책 유틸입니다.
 *
 * 원칙:
 * - 이 파일은 "순수 판정/계산"만 담당합니다(HTTP/DB/파일 I/O 없음).
 * - 컨트롤러는 세션 등 I/O 값을 읽어와 여기로 전달합니다.
 */

export type { BoardWritePolicy, ViewerContext } from "../types/board.types.js";

/**
 * 세션 값(유저 ID/역할)을 기반으로 viewer 컨텍스트를 구성합니다.
 *
 * @param sessionUserId 세션의 userId 후보 값
 * @param sessionUserRole 세션의 userRole 후보 값
 */
export function buildViewerContext(sessionUserId: unknown, sessionUserRole: unknown): ViewerContext {
    const viewerUserId = Number(sessionUserId);
    const isAuthenticated = Number.isFinite(viewerUserId) && viewerUserId > 0;
    const isAdmin = sessionUserRole === "admin";
    return { viewerUserId, isAuthenticated, isAdmin };
}

/**
 * 보드 slug에 따른 "쓰기 권한 정책"을 결정합니다.
 * (예: 공지 보드는 수정/삭제가 admin만 가능)
 *
 * @param slug 보드 slug
 */
export function getBoardWritePolicy(slug: string): BoardWritePolicy {
    if (slug === "announcement") {
        return { update: "admin", delete: "admin" };
    }
    return { update: "self", delete: "selfOrAdmin" };
}

/**
 * 보드 readAccess 정책에 따라, 현재 viewer가 접근 가능한지 판정합니다.
 *
 * @param board 보드 메타
 * @param context viewer 컨텍스트
 * @returns ok | unauthorized(로그인 필요) | forbidden(권한 없음)
 */
export function getBoardReadAccessResult(board: Pick<BoardMeta, "readAccess">, context: ViewerContext): "ok" | "unauthorized" | "forbidden" {
    const readAccess: BoardReadAccess = board.readAccess;

    if (readAccess === "public") {
        return "ok";
    }

    if (readAccess === "admin") {
        if (!context.isAuthenticated) {
            return "unauthorized";
        }
        return context.isAdmin ? "ok" : "forbidden";
    }

    if (!context.isAuthenticated) {
        return "unauthorized";
    }

    return "ok";
}

/**
 * readAccess가 owner_or_admin인 경우, 특정 게시글(postUserId)을 읽을 수 있는지 판정합니다.
 *
 * @param readAccess 보드 readAccess
 * @param context viewer 컨텍스트
 * @param postUserId 게시글 작성자 userId
 */
export function canReadPostForBoard(readAccess: BoardReadAccess, context: ViewerContext, postUserId: number): boolean {
    if (readAccess !== "owner_or_admin") {
        return true;
    }
    return context.isAdmin || context.viewerUserId === postUserId;
}

/**
 * 보드 createAccess 정책에 따라, 현재 viewer가 "글쓰기"를 할 수 있는지 판정합니다.
 *
 * @returns ok | redirect_login(로그인으로 유도) | forbidden(권한 없음)
 */
export function getBoardCreateAccessResult(
    board: Pick<BoardMeta, "createAccess">,
    context: ViewerContext
): "ok" | "redirect_login" | "forbidden" {
    const createAccess: BoardCreateAccess = board.createAccess;

    if (createAccess === "admin") {
        return context.isAdmin ? "ok" : "forbidden";
    }

    // 인증 사용자(auth) 보드는 로그인 여부만 확인합니다.
    return context.isAuthenticated ? "ok" : "redirect_login";
}

/**
 * 게시글 수정 가능 여부를 판정합니다.
 *
 * @param policy 보드 쓰기 정책(수정)
 * @param context viewer 컨텍스트
 * @param postUserId 게시글 작성자 userId
 */
export function canEditPost(policy: BoardWritePolicy, context: ViewerContext, postUserId: number): boolean {
    const isOwner = context.viewerUserId === postUserId;
    return policy.update === "admin" ? context.isAdmin : isOwner;
}

/**
 * 게시글 삭제 가능 여부를 판정합니다.
 *
 * @param policy 보드 쓰기 정책(삭제)
 * @param context viewer 컨텍스트
 * @param postUserId 게시글 작성자 userId
 */
export function canDeletePost(policy: BoardWritePolicy, context: ViewerContext, postUserId: number): boolean {
    const isOwner = context.viewerUserId === postUserId;
    return policy.delete === "admin" ? context.isAdmin : isOwner || context.isAdmin;
}
