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

/**
 * 감사로그 콘솔 출력(outcome) 타입입니다.
 * DB의 성공/실패와 별개로 "콘솔에 어떤 형태로 남길지" 제어할 때 사용합니다.
 */
export type AdminAuditOutcome = "success" | "failure";

/**
 * 감사로그 콘솔(JSON 1줄) 출력 payload 타입입니다.
 *
 * 주의:
 * - 이 payload는 DB 저장 포맷이 아니라, 운영/디버깅을 위한 콘솔 출력 포맷입니다.
 * - 외부 파싱 도구가 붙을 수 있으므로 키 구조는 가급적 안정적으로 유지합니다.
 */
export type AdminAuditCliPayload = {
    timestamp: string;
    source: "admin_audit";
    outcome: AdminAuditOutcome;
    action: AdminAuditAction;
    actorUserId: number | null;
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    details: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
};

/**
 * 감사로그 콘솔 출력 함수에 전달하는 입력 파라미터 타입입니다.
 * 실패(outcome=failure)일 때는 error를 포함할 수 있습니다.
 */
export type EmitAdminAuditCliLogParams = Omit<AdminAuditCliPayload, "timestamp" | "source"> & {
    error?: unknown;
};
