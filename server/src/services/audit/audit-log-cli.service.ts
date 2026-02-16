import { summarizeErrorMessage } from "../../utils/error-summary.util.js";
import { formatKvLine } from "../../utils/log-format.util.js";
import type { AuditAction } from "../../types/audit-action.types.js";
import type { EmitAuditCliLogParams } from "../../types/audit-cli.types.js";
import type { NormalizedAuditLogWriteInput } from "../../types/audit-log-write.types.js";

/**
 * 감사로그 CLI 출력 전용 서비스입니다.
 *
 * 책임:
 * - 감사 이벤트의 콘솔 출력 정책(`AUDIT_CLI_LOG_LEVEL`)을 해석합니다.
 * - 성공/실패 이벤트를 운영 친화적인 한 줄 포맷으로 stdout/stderr에 기록합니다.
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
 * writeAuditLogSafely 실패 시 콘솔에 남길 1줄 요약을 생성합니다.
 */
export function formatAuditSafeWriteErrorLine(params: {
    action: AuditAction;
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
 * 감사 로그를 Node 콘솔에 출력합니다.
 *
 * 정책:
 * - `AUDIT_CLI_LOG_LEVEL=none`이면 아무것도 출력하지 않습니다.
 * - `AUDIT_CLI_LOG_LEVEL=errors`이면 성공(result=success)은 출력하지 않습니다.
 *
 * 출력 포맷:
 * - 성공: stdout에 요약 1줄(`[AUDIT] key=value ...`)
 * - 실패: stderr에 요약 1줄(`[AUDIT] key=value ...`)
 */
export function emitAuditCliLog(params: EmitAuditCliLogParams): void {
    if (auditCliLogLevel === "none") {
        return;
    }
    if (auditCliLogLevel === "errors" && params.result === "success") {
        return;
    }

    const line = formatKvLine(
        "[AUDIT]",
        {
            result: params.result,
            action: params.action,
            actor: params.actor ?? null,
            target: params.target ?? null,
            reason: params.reason ?? (params.error ? summarizeErrorMessage(params.error) : undefined),
        },
        { nullValue: "-", quoteStrings: "auto" }
    );

    if (params.error) {
        console.error(line);
        return;
    }

    console.log(line);
}

function toCliPrincipalLabel(username: string | null, userId: number | null): string | null {
    if (typeof username === "string" && username.length > 0) {
        return username;
    }
    if (typeof userId === "number" && Number.isFinite(userId) && userId > 0) {
        return `#${String(userId)}`;
    }
    return null;
}

function toCliReason(details: Record<string, unknown>): string | undefined {
    const reason = details.reason;
    return typeof reason === "string" && reason.length > 0 ? reason : undefined;
}

function buildCliLogParams(
    input: NormalizedAuditLogWriteInput,
    result: "success" | "failure",
    error?: unknown
): EmitAuditCliLogParams {
    const base: EmitAuditCliLogParams = {
        result,
        action: input.action,
        actor: toCliPrincipalLabel(input.actorUsername, input.actorUserId),
        target: toCliPrincipalLabel(input.targetUsername, input.targetUserId),
    };

    if (result === "failure") {
        const reason = toCliReason(input.details);
        return {
            ...base,
            ...(reason ? { reason } : {}),
            ...(error ? { error } : {}),
        };
    }

    return base;
}

export function emitAuditWriteResultToCli(
    input: NormalizedAuditLogWriteInput,
    result: "success" | "failure",
    error?: unknown
): void {
    emitAuditCliLog(buildCliLogParams(input, result, error));
}
