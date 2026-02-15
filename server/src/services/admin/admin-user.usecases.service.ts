import type { AdminUserMeta } from "../../types/auth.types.js";
import { writeAdminAuditLog } from "../audit.service.js";
import { updateUserActiveStatus, updateUserRole } from "./user-management.service.js";

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

    await writeAdminAuditLog({
        action: params.nextIsActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
        actorUserId: ctx.actorUserId,
        actorUsername: ctx.actorUsername,
        targetUserId: params.target.userId,
        targetUsername: params.target.username,
        details: {
            previousStatus: params.target.isActive ? "active" : "inactive",
            currentStatus: params.nextIsActive ? "active" : "inactive",
        },
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
    requestedRole: "admin" | "user";
}): Promise<boolean> {
    const updated = await updateUserRole({ userId: params.target.userId, userRole: params.requestedRole });
    if (!updated) {
        return false;
    }

    await writeAdminAuditLog({
        action: params.requestedRole === "admin" ? "ADMIN_GRANTED" : "ADMIN_REVOKED",
        actorUserId: ctx.actorUserId,
        actorUsername: ctx.actorUsername,
        targetUserId: params.target.userId,
        targetUsername: params.target.username,
        details: {
            previousRole: params.target.userRole,
            currentRole: params.requestedRole,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
    });

    return true;
}
