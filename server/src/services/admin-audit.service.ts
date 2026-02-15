import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import { summarizeErrorMessage } from "../utils/error-summary.util.js";
import { formatKvLine } from "../utils/log-format.util.js";
import {
    ADMIN_AUDIT_ACTIONS,
    type AdminAuditAction,
    type AdminAuditLog,
    type AdminAuditLogRow,
    type AdminAuditCliPayload,
    type EmitAdminAuditCliLogParams,
} from "../types/admin-audit.types.js";

export type { AdminAuditAction, AdminAuditLog } from "../types/admin-audit.types.js";

/**
 * 어드민 감사로그(Admin Audit) 서비스입니다.
 *
 * 책임:
 * - 감사 이벤트를 DB에 저장하고, 조회 API를 제공합니다.
 * - 콘솔 출력은 `AUDIT_CLI_LOG_LEVEL`로 제어하며, 기본값은 `none`입니다.
 *
 * 설계 의도:
 * - 감사로그는 "DB가 원본(source of truth)"이고, 콘솔 출력은 운영 편의를 위한 보조 수단입니다.
 * - 콘솔 출력이 필요하더라도 성공 로그는 과도해지기 쉬우므로, 기본값을 `none`으로 둡니다.
 */

/**
 * 감사로그를 Node 콘솔에 어느 수준으로 출력할지 결정하는 레벨입니다.
 *
 * - `none`: 콘솔 출력 없음
 * - `errors`: 실패(오류)만 출력
 * - `all`: 성공/실패 모두 출력
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
 * 입력값이 문자열이면 trim 후 비어 있지 않은 값만 반환합니다.
 *
 * @param value 정규화할 입력값
 * @returns 공백 제거된 문자열 또는 null
 */
function normalizeNullable(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

/**
 * 문자열 길이를 지정한 최대 길이로 제한합니다.
 *
 * @param value 길이 제한 대상 문자열
 * @param maxLength 허용 최대 길이
 * @returns 잘린 문자열 또는 null
 */
function truncate(value: string | null, maxLength: number): string | null {
    if (!value) {
        return null;
    }
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * details 필드를 안전한 객체 형태로 정규화합니다.
 * 객체가 아니거나 배열이면 빈 객체를 반환합니다.
 *
 * @param value details 후보 값
 * @returns JSON 저장 가능한 객체
 */
function sanitizeDetails(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

/**
 * 감사 로그 콘솔(JSON 1줄) 출력 payload를 구성합니다.
 * timestamp/source는 내부에서 고정합니다.
 *
 * @param params 콘솔 출력 입력
 * @returns 콘솔에 출력할 JSON payload
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
 * 감사로그 저장 실패 시, 콘솔에 남길 1줄 요약을 생성합니다.
 * key=value 형태로 남겨 grep/파싱이 쉽도록 합니다.
 *
 * @param params 콘솔 출력 입력(실패 케이스)
 * @returns `[AUDIT][ERROR] key=value ...` 형태의 1줄 문자열
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
 *
 * @param params 출력할 감사 이벤트 정보
 */
function emitAdminAuditCliLog(params: EmitAdminAuditCliLogParams) {
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

/**
 * `writeAdminAuditLog` 입력을 DB 저장/콘솔 출력에 적합한 형태로 정규화한 결과입니다.
 *
 * 포함:
 * - trim/길이 제한된 문자열 필드들
 * - 항상 객체로 보장된 details + JSON 직렬화 문자열(detailsJson)
 */
type NormalizedAdminAuditLogWriteInput = {
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

/**
 * 감사로그 저장 입력을 정규화합니다.
 *
 * 처리:
 * - 문자열 정규화/길이 제한
 * - details 객체 형태 강제 및 JSON 직렬화
 *
 * @param params writeAdminAuditLog 입력값
 */
function normalizeAdminAuditLogWriteInput(params: Parameters<typeof writeAdminAuditLog>[0]): NormalizedAdminAuditLogWriteInput {
    const actorUserId = params.actorUserId ?? null;
    const targetUserId = params.targetUserId ?? null;
    const actorUsername = truncate(normalizeNullable(params.actorUsername), 50);
    const targetUsername = truncate(normalizeNullable(params.targetUsername), 50);
    const ipAddress = truncate(normalizeNullable(params.ipAddress), 64);
    const userAgent = truncate(normalizeNullable(params.userAgent), 255);
    const details = sanitizeDetails(params.details);
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
 * 감사로그를 DB에 저장합니다.
 *
 * @param input 정규화된 입력
 */
async function insertAdminAuditLogRow(input: NormalizedAdminAuditLogWriteInput): Promise<void> {
    await sequelize.query(
        `
        INSERT INTO admin_audit_logs (
            action,
            actor_user_id,
            actor_username,
            target_user_id,
            target_username,
            details,
            ip_address,
            user_agent,
            created_at
        )
        VALUES (
            :action,
            :actorUserId,
            :actorUsername,
            :targetUserId,
            :targetUsername,
            CAST(:detailsJson AS jsonb),
            :ipAddress,
            :userAgent,
            NOW()
        )
        `,
        {
            type: QueryTypes.INSERT,
            replacements: {
                action: input.action,
                actorUserId: input.actorUserId,
                actorUsername: input.actorUsername,
                targetUserId: input.targetUserId,
                targetUsername: input.targetUsername,
                detailsJson: input.detailsJson,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            },
        }
    );
}

/**
 * DB 저장 결과를 감사로그 콘솔 출력 함수로 전달합니다.
 *
 * @param outcome 성공/실패
 * @param input 정규화된 입력
 * @param error 실패 시 에러(선택)
 */
function emitAdminAuditWriteOutcomeToCli(
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
 * 관리자 감사 로그를 DB에 저장하고, 동일 이벤트를 CLI 로그로도 남깁니다.
 *
 * 처리 순서:
 * 1) 액션 유효성 검증
 * 2) 문자열/세부정보 정규화
 * 3) DB INSERT
 * 4) 성공/실패 결과를 `[AUDIT]` JSON 로그로 출력
 *
 * @param params 감사 로그 작성 파라미터
 * @throws 지원하지 않는 액션 또는 DB 저장 실패 시 예외를 던집니다.
 */
export async function writeAdminAuditLog(params: {
    action: AdminAuditAction;
    actorUserId?: number | null;
    actorUsername?: string | null;
    targetUserId?: number | null;
    targetUsername?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
}): Promise<void> {
    const action = params.action;
    if (!ADMIN_AUDIT_ACTIONS.includes(action)) {
        throw new Error(`Unsupported admin audit action: ${action}`);
    }

    const input = normalizeAdminAuditLogWriteInput(params);

    try {
        await insertAdminAuditLogRow(input);
        emitAdminAuditWriteOutcomeToCli("success", input);
    } catch (err) {
        emitAdminAuditWriteOutcomeToCli("failure", input, err);
        throw err;
    }
}

/**
 * 감사로그 기록을 "절대 실패시키지 않는" 래퍼입니다.
 * 인증/인가/에러 처리 흐름을 깨지 않기 위해 예외를 삼키고 1줄 요약만 남깁니다.
 *
 * @param params 감사 로그 작성 파라미터
 */
export async function writeAdminAuditLogSafely(
    params: Parameters<typeof writeAdminAuditLog>[0]
): Promise<void> {
    try {
        await writeAdminAuditLog(params);
    } catch (err) {
        console.error(
            formatKvLine(
                "[AUDIT_LOG_ERROR]",
                {
                    action: params.action,
                    reason: summarizeErrorMessage(err),
                },
                { quoteStrings: "auto" }
            )
        );
    }
}

/**
 * 관리자 감사 로그를 최신순으로 조회합니다.
 *
 * @param limit 조회 건수(기본 200, 최소 1, 최대 500)
 * @returns 뷰/컨트롤러에서 사용 가능한 정규화된 감사 로그 목록
 */
export async function listAdminAuditLogs(limit = 200): Promise<AdminAuditLog[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const rows = await sequelize.query<AdminAuditLogRow>(
        `
        SELECT
            audit_log_id,
            action,
            actor_user_id,
            actor_username,
            target_user_id,
            target_username,
            details,
            ip_address,
            user_agent,
            created_at
        FROM admin_audit_logs
        ORDER BY created_at DESC, audit_log_id DESC
        LIMIT :limit
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { limit: safeLimit },
        }
    );

    return rows.map((row) => ({
        auditLogId: Number(row.audit_log_id),
        action: row.action as AdminAuditAction,
        actorUserId: row.actor_user_id === null ? null : Number(row.actor_user_id),
        actorUsername: row.actor_username ?? null,
        targetUserId: row.target_user_id === null ? null : Number(row.target_user_id),
        targetUsername: row.target_username ?? null,
        details: sanitizeDetails(row.details),
        ipAddress: row.ip_address ?? null,
        userAgent: row.user_agent ?? null,
        createdAt: row.created_at,
    }));
}
