/**
 * 보드(게시판) 기능에서 사용하는 타입 모음입니다.
 *
 * 원칙:
 * - 이 파일은 타입만 포함합니다(런타임 값/로직 없음).
 * - 서비스/컨트롤러/유틸 어디에서든 재사용 가능한 "도메인 타입"만 둡니다.
 */

/**
 * 보드 읽기 권한 타입입니다.
 */
export type BoardReadAccess = "public" | "auth" | "admin" | "owner_or_admin";

/**
 * 보드 글쓰기 권한 타입입니다.
 */
export type BoardCreateAccess = "auth" | "admin";

/**
 * 보드 메타 정보입니다.
 */
export type BoardMeta = {
    boardId: number;
    slug: string;
    name: string;
    description: string | null;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
};

/**
 * 게시글 기본 레코드(서비스 계층에서 사용하는 공통 형태)입니다.
 */
export type BoardPostRecord = {
    postId: number;
    boardId: number;
    boardSlug: string;
    boardName: string;
    displayId: number;
    userId: number;
    title: string;
    content: string;
    imageUrl: string | null;
    fileUrl: string | null;
};

/**
 * 게시글 목록(outline)에서 사용하는 요약 타입입니다.
 */
export interface BoardPostOutline {
    boardSlug: string;
    displayId: number;
    userId: number;
    title: string;
    author: string;
    createdAt: Date;
}

/**
 * 보드 쓰기 정책(수정/삭제)을 나타냅니다.
 */
export type BoardWritePolicy = {
    update: "self" | "admin";
    delete: "selfOrAdmin" | "admin";
};

/**
 * 현재 viewer(세션)의 인증/권한 컨텍스트입니다.
 */
export type ViewerContext = {
    viewerUserId: number;
    isAuthenticated: boolean;
    isAdmin: boolean;
};

/**
 * 게시글 상세 화면에서 사용하는 데이터 형태입니다.
 * (템플릿 호환을 위해 snake_case 키를 유지합니다.)
 */
export type BoardPostForShow = {
    board_slug: string;
    display_id: number;
    title: string;
    username: string;
    content: string;
    image_url: string | null;
    file_url: string | null;
    file_name: string | null;
    created_at: string;
    updated_at: string | null;
    user_id: number;
    board_name: string;
    board_id: number;
};

/**
 * 게시글 상세 화면에서 사용하는 이전/다음 게시글 링크 타입입니다.
 */
export type NeighborPost = { display_id: number; title: string } | null;
