import { summarizeErrorMessage } from "../../utils/error-summary.util.js";
import { formatKvLine } from "../../utils/log-format.util.js";
import type { NormalizedAdminAuditLogWriteInput } from "../../types/admin-audit-write.types.js";
import type { AdminAuditAction } from "../../types/audit-log.types.js";
import type { AdminAuditCliPayload, EmitAdminAuditCliLogParams } from "../../types/audit-log-cli.types.js";

/**
 * 감사로그 CLI 출력 전용 서비스입니다.
 *
 * 책임:
 * - 감사 이벤트의 콘솔 출력 정책(`AUDIT_CLI_LOG_LEVEL`)을 해석합니다.
 * - 성공/실패 이벤트를 운영 친화적인 포맷으로 stdout/stderr에 기록합니다.
 */

type AuditCliLogLevel = "none" | "errors" | "all";

/**
 * `AUDIT_CLI_LOG_LEVEL` 환경변수를 해석하여 콘솔 출력 레벨을 결정합니다.
 * 유효하지 않은 값이면 안전하게 `none`으로 폴백합니다.
 */
function getAuditCliLogLevel(): AuditCliLogLevel {
    const raw = String(process.env.AUDIT_CLI_LOG_LEVEL ?? "none").trim().toLowerCase();
    if (raw === "none" || raw === "errors" || raw === "all") {
        return raw;
    }
    console.warn(`[CONFIG] Invalid AUDIT_CLI_LOG_LEVEL="${raw}". Falling back to "none".`);
    return "none";
}

/**
 * 현재 프로세스에서 사용할 감사로그 콘솔 출력 레벨(서버 시작 시 1회 결정)입니다.
 */
const auditCliLogLevel = getAuditCliLogLevel();

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

/**
 * DB 저장 결과를 감사로그 콘솔 출력 함수로 전달합니다.
 */
export function emitAdminAuditWriteOutcomeToCli(
    outcome: "success" | "failure",
    input: NormalizedAdminAuditLogWriteInput,
    error?: unknown
): void {
    emitAdminAuditCliLog({
        outcome,
        action: input.action,
        actorUserId: input.actorUserId,
        actorUsername: input.actorUsername,
        targetUserId: input.targetUserId,
        targetUsername: input.targetUsername,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        error,
    });
}

/**
 * 감사로그 CLI 출력용 JSON payload를 구성합니다.
 */
function buildAdminAuditCliPayload(params: EmitAdminAuditCliLogParams): AdminAuditCliPayload {
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
function formatAdminAuditCliErrorLine(params: EmitAdminAuditCliLogParams): string {
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

/**
 * 감사 로그를 Node 콘솔에 출력합니다.
 *
 * 정책:
 * - `AUDIT_CLI_LOG_LEVEL=none`이면 아무것도 출력하지 않습니다.
 * - `AUDIT_CLI_LOG_LEVEL=errors`이면 성공(outcome=success)은 출력하지 않습니다.
 *
 * 출력 포맷:
 * - 성공: stdout에 JSON 1줄(`[AUDIT] {...}`)
 * - 실패: stderr에 요약 1줄(`[AUDIT][ERROR] key=value ...`)
 */
export function emitAdminAuditCliLog(params: EmitAdminAuditCliLogParams): void {
    if (auditCliLogLevel === "none") {
        return;
    }
    if (auditCliLogLevel === "errors" && params.outcome === "success") {
        return;
    }

    if (params.error) {
        console.error(formatAdminAuditCliErrorLine(params));
        return;
    }

    const payload = buildAdminAuditCliPayload(params);
    console.log("[AUDIT]", JSON.stringify(payload));
}
