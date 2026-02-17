/**
 * `audit_logs` 원시 조회 결과 타입(DB 컬럼 스네이크 케이스 기준)입니다.
 */
export type AuditLogRow = {
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
