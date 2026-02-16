/**
 * 관리자 감사 로그에서 허용하는 액션 목록입니다.
 * DB 체크 제약과 동일한 범위를 유지해야 합니다.
 */
export const ADMIN_AUDIT_ACTIONS = [
    "LOGIN",
    "LOGIN_FAILED",
    "LOGOUT",
    "ACCOUNT_CREATED",
    "ACCOUNT_ACTIVATED",
    "ACCOUNT_DEACTIVATED",
    "ADMIN_GRANTED",
    "ADMIN_REVOKED",
    "AUTHZ_DENIED",
    "CSRF_INVALID",
    "ADMIN_PAGE_ACCESS_ATTEMPT",
] as const;

/**
 * 감사 로그 액션 문자열 유니온 타입입니다.
 */
export type AdminAuditAction = typeof ADMIN_AUDIT_ACTIONS[number];

/**
 * 임의 문자열이 감사 로그 액션인지 검증하는 타입가드입니다.
 */
export function isAdminAuditAction(value: string): value is AdminAuditAction {
    return (ADMIN_AUDIT_ACTIONS as readonly string[]).includes(value);
}

/**
 * `admin_audit_logs` 원시 조회 결과 타입(DB 컬럼 스네이크 케이스 기준)입니다.
 */
export type AdminAuditLogRow = {
    audit_log_id: number;
    action: string;
    actor_user_id: number | null;
    actor_username: string | null;
    target_user_id: number | null;
    target_username: string | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
};

/**
 * 애플리케이션 레이어에서 사용하는 감사 로그 정규화 타입입니다.
 * 컨트롤러/뷰로 전달할 때 이 타입을 사용합니다.
 */
export type AdminAuditLog = {
    auditLogId: number;
    action: AdminAuditAction;
    actorUserId: number | null;
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    details: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
};

