import type { AdminAuditAction } from "./audit-log.types.js";

/**
 * 감사로그 쓰기 API 입력 타입입니다.
 */
export type AdminAuditLogWriteParams = {
    action: AdminAuditAction;
    actorUserId?: number | null;
    actorUsername?: string | null;
    targetUserId?: number | null;
    targetUsername?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
};

/**
 * 감사로그 쓰기 입력을 정규화한 내부 타입입니다.
 */
export type NormalizedAdminAuditLogWriteInput = {
    action: AdminAuditAction;
    actorUserId: number | null;
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    details: Record<string, unknown>;
    detailsJson: string;
    ipAddress: string | null;
    userAgent: string | null;
};
