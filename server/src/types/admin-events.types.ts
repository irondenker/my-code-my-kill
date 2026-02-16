/**
 * @deprecated `audit-log.types.ts`, `audit-log-cli.types.ts`, `admin-audit-write.types.ts`를 사용하세요.
 * 하위 호환을 위해 re-export만 유지합니다.
 */

export {
    ADMIN_AUDIT_ACTIONS,
    isAdminAuditAction,
    type AdminAuditAction,
    type AdminAuditLog,
    type AdminAuditLogRow,
} from "./audit-log.types.js";
export type {
    AdminAuditOutcome,
    AdminAuditCliPayload,
    EmitAdminAuditCliLogParams,
} from "./audit-log-cli.types.js";
export type {
    AdminAuditLogWriteParams,
    NormalizedAdminAuditLogWriteInput,
} from "./admin-audit-write.types.js";
