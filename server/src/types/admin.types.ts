import type { BoardCreateAccess, BoardReadAccess } from "./board.types.js";

/**
 * 어드민 UI에서 사용하는 사용자 상태 타입입니다.
 * (DB 필드 `is_active`를 UI 의미로 변환한 값)
 */
export type AdminUserStatus = "active" | "inactive";

/**
 * 어드민 정책 검증 결과 타입입니다.
 */
export type AdminPolicyResult =
    | { ok: true }
    | { ok: true; noChange: true }
    | { ok: false; message: string };

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
