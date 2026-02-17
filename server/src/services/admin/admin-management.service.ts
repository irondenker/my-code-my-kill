import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { AdminUserMeta, AdminUserSummary } from "../../types/auth.types.js";
import type { UserRole } from "../../types/user-role.types.js";
import {
    logAccountStatusChangedSafely,
    logAdminRoleChangedSafely,
} from "../audit.service.js";

export type AdminAuditContext = {
    actorUserId: number;
    actorUsername: string | null;
    ipAddress: string | null;
    userAgent: string | null;
};

/**
 * 어드민 유저 목록을 조회합니다.
 */
export async function listUsersForAdmin(): Promise<AdminUserSummary[]> {
    const rows = await sequelize.query<{
        user_id: number;
        username: string;
        user_role: string;
        is_active: boolean;
        created_at: Date;
    }>(
        `
        SELECT
            user_id,
            username,
            user_role,
            is_active,
            created_at
        FROM users
        ORDER BY user_id ASC
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.map((row) => ({
        userId: Number(row.user_id),
        username: row.username,
        userRole: row.user_role as AdminUserSummary["userRole"],
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
    }));
}

/**
 * 어드민 정책/화면용 사용자 최소 메타 정보를 조회합니다.
 */
export async function findUserMetaForAdminById(userId: number): Promise<AdminUserMeta | null> {
    const rows = await sequelize.query<{
        user_id: number;
        username: string;
        user_role: string;
        is_active: boolean;
    }>(
        `
        SELECT
            user_id,
            username,
            user_role,
            is_active
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { userId } }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return {
        userId: Number(row.user_id),
        username: row.username,
        userRole: row.user_role as AdminUserMeta["userRole"],
        isActive: Boolean(row.is_active),
    };
}

/**
 * admin 역할 사용자 수를 반환합니다.
 */
export async function countAdminUsers(): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM users
        WHERE user_role = 'admin'
        `,
        { type: QueryTypes.SELECT }
    );

    return Number(rows[0]?.total_count ?? 0);
}

/**
 * 사용자 활성/비활성 상태를 변경합니다.
 */
export async function updateUserActiveStatus(params: { userId: number; isActive: boolean }): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET is_active = :isActive,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT, replacements: { userId: params.userId, isActive: params.isActive } }
    );

    return rows.length > 0;
}

/**
 * 사용자 역할(user/admin)을 변경합니다.
 */
export async function updateUserRole(params: { userId: number; userRole: UserRole }): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET user_role = :userRole,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT, replacements: { userId: params.userId, userRole: params.userRole } }
    );

    return rows.length > 0;
}

/**
 * 어드민 유저 활성/비활성 변경 유즈케이스입니다.
 */
export async function adminUpdateUserStatus(ctx: AdminAuditContext, params: {
    target: AdminUserMeta;
    nextIsActive: boolean;
}): Promise<boolean> {
    const updated = await updateUserActiveStatus({ userId: params.target.userId, isActive: params.nextIsActive });
    if (!updated) {
        return false;
    }

    await logAccountStatusChangedSafely({
        actorUserId: ctx.actorUserId,
        actorUsername: ctx.actorUsername,
        targetUserId: params.target.userId,
        targetUsername: params.target.username,
        previousStatus: params.target.isActive ? "active" : "inactive",
        currentStatus: params.nextIsActive ? "active" : "inactive",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
    });

    return true;
}

/**
 * 어드민 유저 역할 변경 유즈케이스입니다.
 */
export async function adminUpdateUserRole(ctx: AdminAuditContext, params: {
    target: AdminUserMeta;
    requestedRole: UserRole;
}): Promise<boolean> {
    const updated = await updateUserRole({ userId: params.target.userId, userRole: params.requestedRole });
    if (!updated) {
        return false;
    }

    await logAdminRoleChangedSafely({
        actorUserId: ctx.actorUserId,
        actorUsername: ctx.actorUsername,
        targetUserId: params.target.userId,
        targetUsername: params.target.username,
        previousRole: params.target.userRole,
        currentRole: params.requestedRole,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
    });

    return true;
}
