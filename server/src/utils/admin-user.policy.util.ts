import type {
    AdminUserRole,
    AdminUserStatus,
    AdminUserTargetMeta,
    PolicyAllow,
    PolicyDeny,
    PolicyNoChange,
} from "../types/admin.types.js";

export type {
    AdminUserRole,
    AdminUserStatus,
    AdminUserTargetMeta,
    PolicyAllow,
    PolicyDeny,
    PolicyNoChange,
};

/**
 * 어드민 유저 삭제 정책을 검증합니다.
 *
 * - 자기 자신은 삭제 불가
 * - admin 계정 삭제 시 최소 1명의 admin은 남아야 함
 *
 * @param params 정책 판단에 필요한 최소 정보
 */
export function validateAdminUserDeletePolicy(params: {
    actorUserId: number;
    target: AdminUserTargetMeta;
    adminCount?: number;
}): PolicyAllow | PolicyDeny {
    if (params.actorUserId === params.target.userId) {
        return { ok: false, message: "You cannot delete your own account." };
    }

    if (params.target.userRole === "admin") {
        const adminCount = typeof params.adminCount === "number" ? params.adminCount : 0;
        if (adminCount <= 1) {
            return { ok: false, message: "At least one admin account must remain." };
        }
    }

    return { ok: true };
}

/**
 * 어드민 유저 활성/비활성 변경 정책을 검증합니다.
 *
 * - 자기 자신(admin)의 비활성화는 금지
 * - admin 계정은 비활성화 불가(운영 정책)
 *
 * @param params 정책 판단에 필요한 최소 정보
 */
export function validateAdminUserStatusPolicy(params: {
    actorUserId: number;
    target: AdminUserTargetMeta;
    nextStatus: AdminUserStatus;
}): PolicyAllow | PolicyDeny | PolicyNoChange {
    const nextIsActive = params.nextStatus === "active";

    if (params.target.isActive === nextIsActive) {
        return { ok: true, noChange: true };
    }

    if (params.actorUserId === params.target.userId && !nextIsActive) {
        return { ok: false, message: "You cannot deactivate your own admin account." };
    }

    if (!nextIsActive && params.target.userRole === "admin") {
        return { ok: false, message: "Admin accounts cannot be deactivated." };
    }

    return { ok: true };
}

/**
 * 어드민 유저 역할 변경(user/admin) 정책을 검증합니다.
 *
 * - 자기 자신의 admin 권한 회수 금지
 * - admin -> user 로 변경 시 최소 1명의 admin은 남아야 함
 *
 * @param params 정책 판단에 필요한 최소 정보
 */
export function validateAdminUserRolePolicy(params: {
    actorUserId: number;
    target: AdminUserTargetMeta;
    requestedRole: AdminUserRole;
    adminCount?: number;
}): PolicyAllow | PolicyDeny | PolicyNoChange {
    if (params.target.userRole === params.requestedRole) {
        return { ok: true, noChange: true };
    }

    if (
        params.actorUserId === params.target.userId &&
        params.target.userRole === "admin" &&
        params.requestedRole === "user"
    ) {
        return { ok: false, message: "You cannot revoke your own admin role." };
    }

    if (params.target.userRole === "admin" && params.requestedRole === "user") {
        const adminCount = typeof params.adminCount === "number" ? params.adminCount : 0;
        if (adminCount <= 1) {
            return { ok: false, message: "At least one admin account must remain." };
        }
    }

    return { ok: true };
}

/**
 * deleteUserForAdmin 결과를 UI 메시지로 매핑합니다.
 *
 * @param result 삭제 시도 결과
 */
export function mapDeleteUserResultToErrorMessage(
    result: "deleted" | "not_found" | "has_posts"
): string | null {
    if (result === "has_posts") {
        return "Users with posts cannot be deleted. Deactivate instead.";
    }
    return null;
}
