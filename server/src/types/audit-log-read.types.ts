import type {
    AuditActorFields,
    AuditDetailsField,
    AuditRequestMetaFields,
    AuditTargetFields,
} from "./audit-common.types.js";
import type { AuditAction } from "./audit-action.types.js";

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

/**
 * 애플리케이션 레이어에서 사용하는 감사 로그 정규화 타입입니다.
 * 컨트롤러/뷰로 전달할 때 이 타입을 사용합니다.
 */
export type AuditLog = {
    auditLogId: number;
    action: AuditAction;
    createdAt: Date;
} & AuditActorFields & AuditTargetFields & AuditDetailsField & AuditRequestMetaFields;
