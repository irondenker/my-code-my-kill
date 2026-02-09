import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";

const ADMIN_AUDIT_ACTIONS = [
    "LOGIN",
    "LOGOUT",
    "ACCOUNT_CREATED",
    "ACCOUNT_DELETED",
    "ACCOUNT_ACTIVATED",
    "ACCOUNT_DEACTIVATED",
    "ADMIN_GRANTED",
    "ADMIN_REVOKED",
] as const;

export type AdminAuditAction = typeof ADMIN_AUDIT_ACTIONS[number];

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

function normalizeNullable(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function truncate(value: string | null, maxLength: number): string | null {
    if (!value) {
        return null;
    }
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeDetails(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

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
    const details = params.details ?? {};
    const detailsJson = JSON.stringify(details);

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
        }
    );
}

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
