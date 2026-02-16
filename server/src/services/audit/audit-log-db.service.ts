import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import { sanitizeRecord } from "../../utils/record.util.js";
import { isAuditAction } from "../../types/audit-action.types.js";
import type { AuditLog, AuditLogRow } from "../../types/audit-log-read.types.js";
import type { NormalizedAuditLogWriteInput } from "../../types/audit-log-write.types.js";

const AUDIT_LOGS_TABLE = "audit_logs";

/**
 * 감사로그 DB 저장 전용 함수입니다.
 *
 * @param input 정규화된 입력
 */
export async function createAuditLog(
    input: NormalizedAuditLogWriteInput
): Promise<void> {
    await sequelize.query(
        `
        INSERT INTO ${AUDIT_LOGS_TABLE} (
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
 * 감사 로그를 최신순으로 조회합니다.
 *
 * @param limit 조회 건수(기본 200, 최소 1, 최대 500)
 * @returns 뷰/컨트롤러에서 사용 가능한 정규화된 감사 로그 목록
 */
export async function listAuditLogs(limit = 200): Promise<AuditLog[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const rows = await sequelize.query<AuditLogRow>(
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
        FROM ${AUDIT_LOGS_TABLE}
        ORDER BY created_at DESC, audit_log_id DESC
        LIMIT :limit
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { limit: safeLimit },
        }
    );

    const logs: AuditLog[] = [];
    for (const row of rows) {
        if (!isAuditAction(row.action)) {
            console.warn(
                `[AUDIT][WARN] Skipping audit_log_id=${String(row.audit_log_id)} with unsupported action="${row.action}".`
            );
            continue;
        }

        logs.push({
            auditLogId: Number(row.audit_log_id),
            action: row.action,
            actorUserId: row.actor_user_id === null ? null : Number(row.actor_user_id),
            actorUsername: row.actor_username ?? null,
            targetUserId: row.target_user_id === null ? null : Number(row.target_user_id),
            targetUsername: row.target_username ?? null,
            details: sanitizeRecord(row.details),
            ipAddress: row.ip_address ?? null,
            userAgent: row.user_agent ?? null,
            createdAt: row.created_at,
        });
    }
    return logs;
}
