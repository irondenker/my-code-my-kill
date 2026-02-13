import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";

/**
 * 관리자 감사 로그에서 허용하는 액션 목록입니다.
 * DB 체크 제약과 동일한 범위를 유지해야 합니다.
 */
const ADMIN_AUDIT_ACTIONS = [
    "LOGIN",
    "LOGIN_FAILED",
    "LOGOUT",
    "ACCOUNT_CREATED",
    "ACCOUNT_DELETED",
    "ACCOUNT_ACTIVATED",
    "ACCOUNT_DEACTIVATED",
    "ADMIN_GRANTED",
    "ADMIN_REVOKED",
    "AUTHZ_DENIED",
    "CSRF_INVALID",
    "ADMIN_PAGE_ACCESS_ATTEMPT",
] as const;

/**
 * 감사 로그 액션 문자열 유니온 타입입니다.
 */
export type AdminAuditAction = typeof ADMIN_AUDIT_ACTIONS[number];

/**
 * `admin_audit_logs` 원시 조회 결과 타입(DB 컬럼 스네이크 케이스 기준)입니다.
 */
type AdminAuditLogRow = {
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
export type AdminAuditLog = {
    auditLogId: number;
    action: AdminAuditAction;
    actorUserId: number | null;
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    details: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
};

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
 * 감사 로그 저장 결과를 Node CLI(JSON 1줄)로 출력합니다.
 * 성공은 stdout, 실패는 stderr로 분리합니다.
 *
 * @param params 출력할 감사 이벤트 정보
 */
function emitAdminAuditCliLog(params: {
    outcome: "success" | "failure";
    action: string;
    actorUserId: number | null;
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    details: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
    error?: unknown;
}) {
    const payload: Record<string, unknown> = {
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

    if (params.error) {
        const error =
            params.error instanceof Error
                ? {
                    name: params.error.name,
                    message: params.error.message,
                }
                : { message: String(params.error) };
        console.error("[AUDIT]", JSON.stringify({ ...payload, error }));
        return;
    }

    console.log("[AUDIT]", JSON.stringify(payload));
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

    const actorUserId = params.actorUserId ?? null;
    const targetUserId = params.targetUserId ?? null;
    const actorUsername = truncate(normalizeNullable(params.actorUsername), 50);
    const targetUsername = truncate(normalizeNullable(params.targetUsername), 50);
    const ipAddress = truncate(normalizeNullable(params.ipAddress), 64);
    const userAgent = truncate(normalizeNullable(params.userAgent), 255);
    const details = sanitizeDetails(params.details);
    const detailsJson = JSON.stringify(details);

    try {
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
                    action,
                    actorUserId,
                    actorUsername,
                    targetUserId,
                    targetUsername,
                    detailsJson,
                    ipAddress,
                    userAgent,
                },
            },
        );
        emitAdminAuditCliLog({
            outcome: "success",
            action,
            actorUserId,
            actorUsername,
            targetUserId,
            targetUsername,
            details,
            ipAddress,
            userAgent,
        });
    } catch (err) {
        emitAdminAuditCliLog({
            outcome: "failure",
            action,
            actorUserId,
            actorUsername,
            targetUserId,
            targetUsername,
            details,
            ipAddress,
            userAgent,
            error: err,
        });
        throw err;
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
