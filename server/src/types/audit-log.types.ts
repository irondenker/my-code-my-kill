import type {
    AuditActorFields,
    AuditDetailsField,
    AuditRequestMetaFields,
    AuditTargetFields,
} from "./audit-common.types.js";
import type { AuditAction } from "./audit-action.types.js";

/**
 * 애플리케이션 레이어에서 사용하는 감사 로그 정규화 타입입니다.
 * 컨트롤러/뷰로 전달할 때 이 타입을 사용합니다.
 */
export type AuditLog = {
    auditLogId: number;
    action: AuditAction;
    createdAt: Date;
} & AuditActorFields & AuditTargetFields & AuditDetailsField & AuditRequestMetaFields;
