import type { AdminUserMeta } from "../../types/auth.types.js";
import type { UserRole } from "../../types/user-role.types.js";
import {
    logAccountStatusChangedSafely,
    logAdminRoleChangedSafely,
} from "../audit.service.js";
import { updateUserActiveStatus, updateUserRole } from "./user-management.data.service.js";

export type AdminAuditContext = {
    actorUserId: number;
    actorUsername: string | null;
    ipAddress: string | null;
    userAgent: string | null;
};

/**
 * 어드민 유저 활성/비활성 변경 유즈케이스입니다.
 *
 * - update 성공 시에만 감사로그를 기록합니다.
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
 *
 * - update 성공 시에만 감사로그를 기록합니다.
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
