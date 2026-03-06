/**
 * 보드(게시판) 기능에서 사용하는 타입 모음입니다.
 *
 * 원칙:
 * - 이 파일은 타입만 포함합니다(런타임 값/로직 없음).
 * - 서비스/컨트롤러/유틸 어디에서든 재사용 가능한 "보드 도메인 타입"만 둡니다.
 * - 게시글(Article) 타입은 `article.types.ts`에서 관리합니다.
 */

/**
 * 보드 읽기 권한 타입입니다.
 */
export type BoardReadAccess = 'public' | 'auth' | 'admin' | 'owner_or_admin';

/**
 * 보드 글쓰기 권한 타입입니다.
 */
export type BoardCreateAccess = 'auth' | 'admin';

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
 * 현재 viewer(세션)의 인증/권한 컨텍스트입니다.
 */
export type ViewerContext = {
  viewerUserId: number;
  isAuthenticated: boolean;
  isAdmin: boolean;
};
