import { writeAdminAuditLogSafely } from "./admin-audit.service.js";

type LoginFailedReason = "missing_credentials" | "invalid_credentials" | "inactive_account";

/**
 * 인증(Auth) 관련 감사로그를 기록하는 서비스입니다.
 * 컨트롤러에서 payload 구성 중복을 줄이기 위해 auth 전용 이벤트를 여기로 모읍니다.
 */

/**
 * 로그인 실패 이벤트를 감사로그에 기록합니다.
 *
 * - actor는 비로그인 상태(null)로 저장합니다.
 * - attemptedUsername/실패 사유는 details에 포함합니다.
 *
 * @param params 로그인 실패 상세
 */
export async function logLoginFailed(params: {
    attemptedUsername: string | null;
    reason: LoginFailedReason;
    targetUserId?: number | null;
    targetUsername?: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}): Promise<void> {
    await writeAdminAuditLogSafely({
        action: "LOGIN_FAILED",
        actorUserId: null,
        actorUsername: params.attemptedUsername,
        targetUserId: params.targetUserId ?? null,
        targetUsername: params.targetUsername ?? params.attemptedUsername,
        details: {
            loginResult: "failure",
            reason: params.reason,
            attemptedUsername: params.attemptedUsername,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * 로그인 성공 이벤트를 감사로그에 기록합니다.
 *
 * @param params 로그인 성공 상세
 */
export async function logLoginSuccess(params: {
    userId: number;
    username: string;
    userRole: "admin" | "user";
    ipAddress: string | null;
    userAgent: string | null;
}): Promise<void> {
    await writeAdminAuditLogSafely({
        action: "LOGIN",
        actorUserId: params.userId,
        actorUsername: params.username,
        targetUserId: params.userId,
        targetUsername: params.username,
        details: {
            loginResult: "success",
            userRole: params.userRole,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * 로그아웃 성공 이벤트를 감사로그에 기록합니다.
 *
 * @param params 로그아웃 성공 상세
 */
export async function logLogoutSuccess(params: {
    userId: number;
    username: string | null;
    userRole: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}): Promise<void> {
    await writeAdminAuditLogSafely({
        action: "LOGOUT",
        actorUserId: params.userId,
        actorUsername: params.username,
        targetUserId: params.userId,
        targetUsername: params.username,
        details: {
            logoutResult: "success",
            userRole: params.userRole,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}
