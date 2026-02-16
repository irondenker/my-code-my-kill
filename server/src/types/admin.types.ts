import type { BoardCreateAccess, BoardReadAccess } from "./board.types.js";

/**
 * 어드민 관점의 사용자 역할 타입입니다.
 */
export type AdminUserRole = "admin" | "user";

/**
 * 어드민 UI에서 사용하는 사용자 상태 타입입니다.
 * (DB 필드 `is_active`를 UI 의미로 변환한 값)
 */
export type AdminUserStatus = "active" | "inactive";

/**
 * 어드민 정책 판단에 필요한 대상 사용자 최소 메타 정보입니다.
 */
export type AdminUserTargetMeta = {
    userId: number;
    userRole: AdminUserRole;
    isActive: boolean;
};

/**
 * 정책 검증 결과: 허용.
 */
export type PolicyAllow = { ok: true };

/**
 * 정책 검증 결과: 거부(사용자에게 노출 가능한 메시지 포함).
 */
export type PolicyDeny = { ok: false; message: string };

/**
 * 정책 검증 결과: 허용(이미 동일 상태라 변경 불필요).
 */
export type PolicyNoChange = { ok: true; noChange: true };

/**
 * 어드민 보드 생성/수정 폼에서 사용하는 값 모델입니다.
 * (뷰 렌더링 시 사용)
 */
export type BoardFormValue = {
    slug: string;
    name: string;
    description: string;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
};
