/**
 * 감사 로그에서 허용하는 액션 목록입니다.
 * DB 체크 제약과 동일한 범위를 유지해야 합니다.
 */
export const AUDIT_ACTIONS = [
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
    "PASSWORD_RESET_REQUESTED",
    "PASSWORD_RESET_COMPLETED",
    "ACCOUNT_LOCKED",
    "RATE_LIMITED",
] as const;

/**
 * 감사 로그 액션 문자열 유니온 타입입니다.
 */
export type AuditAction = typeof AUDIT_ACTIONS[number];

/**
 * 임의 문자열이 감사 로그 액션인지 검증하는 타입가드입니다.
 */
export function isAuditAction(value: string): value is AuditAction {
    return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
