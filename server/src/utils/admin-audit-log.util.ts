import { summarizeErrorMessage } from "./error-summary.util.js";
import { formatKvLine } from "./log-format.util.js";
import { sanitizeRecord } from "./record.util.js";
import { normalizeNullableString, truncateNullableString } from "./string.util.js";
import type { AdminAuditLogWriteParams, NormalizedAdminAuditLogWriteInput } from "../types/admin-audit-write.types.js";
import type { AdminAuditAction } from "../types/audit-log.types.js";

/**
 * 감사로그 저장 입력을 DB 저장/CLI 출력에 적합한 형태로 정규화합니다.
 */
export function normalizeAdminAuditLogWriteInput(
    params: AdminAuditLogWriteParams
): NormalizedAdminAuditLogWriteInput {
    const actorUserId = params.actorUserId ?? null;
    const targetUserId = params.targetUserId ?? null;
    const actorUsername = truncateNullableString(normalizeNullableString(params.actorUsername), 50);
    const targetUsername = truncateNullableString(normalizeNullableString(params.targetUsername), 50);
    const ipAddress = truncateNullableString(normalizeNullableString(params.ipAddress), 64);
    const userAgent = truncateNullableString(normalizeNullableString(params.userAgent), 255);
    const details = sanitizeRecord(params.details);
    const detailsJson = JSON.stringify(details);

    return {
        action: params.action,
        actorUserId,
        actorUsername,
        targetUserId,
        targetUsername,
        details,
        detailsJson,
        ipAddress,
        userAgent,
    };
}

/**
 * writeAdminAuditLogSafely 실패 시 콘솔에 남길 1줄 요약을 생성합니다.
 */
export function formatAdminAuditSafeWriteErrorLine(params: {
    action: AdminAuditAction;
    error: unknown;
}): string {
    return formatKvLine(
        "[AUDIT_LOG_ERROR]",
        {
            action: params.action,
            reason: summarizeErrorMessage(params.error),
        },
        { quoteStrings: "auto" }
    );
}
