import { summarizeErrorMessage } from "./error-summary.util.js";
import { formatKvLine } from "./log-format.util.js";
import type { AdminAuditCliPayload, EmitAdminAuditCliLogParams } from "../types/audit-log-cli.types.js";

/**
 * 감사로그 CLI 출력용 JSON payload를 구성합니다.
 */
export function buildAdminAuditCliPayload(params: EmitAdminAuditCliLogParams): AdminAuditCliPayload {
    return {
        timestamp: new Date().toISOString(),
        source: "admin_audit",
        outcome: params.outcome,
        action: params.action,
        actorUserId: params.actorUserId,
        actorUsername: params.actorUsername,
        targetUserId: params.targetUserId,
        targetUsername: params.targetUsername,
        details: params.details,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}

/**
 * 감사로그 실패 이벤트를 key=value 1줄 형식으로 포맷합니다.
 */
export function formatAdminAuditCliErrorLine(params: EmitAdminAuditCliLogParams): string {
    const reason = params.error ? summarizeErrorMessage(params.error) : "-";
    return formatKvLine(
        "[AUDIT][ERROR]",
        {
            action: params.action,
            actor: params.actorUserId,
            target: params.targetUserId,
            ip: params.ipAddress,
            reason,
        },
        { nullValue: "-", quoteStrings: "auto" }
    );
}
