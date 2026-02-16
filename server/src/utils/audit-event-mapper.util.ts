import type { LoginFailedReason } from "../types/auth.types.js";
import type {
    AuditActorFields,
    AuditHttpRequestMetaFields,
    AuditRequestMetaFields,
} from "../types/audit-common.types.js";
import type { AuditLogWriteParams } from "../types/audit-log-write.types.js";
import type { UserRole } from "../types/user-role.types.js";

/**
 * 로그인 실패 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildLoginFailedAuditLogWriteParams(params: AuditRequestMetaFields & {
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    attemptedUsername: string | null;
    reason: LoginFailedReason;
}): AuditLogWriteParams {
    return {
        action: "LOGIN_FAILED",
        actorUserId: null,
        actorUsername: params.actorUsername,
        targetUserId: params.targetUserId,
        targetUsername: params.targetUsername,
        details: {
            loginResult: "failure",
            reason: params.reason,
            attemptedUsername: params.attemptedUsername,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}

/**
 * 로그인 성공 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildLoginSuccessAuditLogWriteParams(params: AuditRequestMetaFields & {
    userId: number;
    username: string;
    userRole: UserRole;
}): AuditLogWriteParams {
    return {
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
    };
}

/**
 * 로그아웃 성공 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildLogoutSuccessAuditLogWriteParams(params: AuditRequestMetaFields & {
    userId: number;
    username: string | null;
    userRole: UserRole | null | undefined;
}): AuditLogWriteParams {
    return {
        action: "LOGOUT",
        actorUserId: params.userId,
        actorUsername: params.username,
        targetUserId: params.userId,
        targetUsername: params.username,
        details: {
            logoutResult: "success",
            userRole: params.userRole ?? null,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}

/**
 * 관리자 페이지 접근 시도 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildAdminPageAccessAttemptAuditLogWriteParams(params: AuditActorFields & AuditHttpRequestMetaFields & {
    result: "allowed" | "redirect_login" | "forbidden";
    reason: string;
}): AuditLogWriteParams {
    return {
        action: "ADMIN_PAGE_ACCESS_ATTEMPT",
        actorUserId: params.actorUserId,
        actorUsername: params.actorUsername,
        targetUserId: null,
        targetUsername: null,
        details: {
            result: params.result,
            reason: params.reason,
            method: params.method,
            path: params.path,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}

/**
 * 인가 거부 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildAuthzDeniedAuditLogWriteParams(params: AuditActorFields & AuditHttpRequestMetaFields & {
    reason: string;
}): AuditLogWriteParams {
    return {
        action: "AUTHZ_DENIED",
        actorUserId: params.actorUserId,
        actorUsername: params.actorUsername,
        targetUserId: null,
        targetUsername: null,
        details: {
            method: params.method,
            path: params.path,
            reason: params.reason,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}

/**
 * CSRF 검증 실패 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildCsrfInvalidAuditLogWriteParams(params: AuditActorFields & AuditHttpRequestMetaFields): AuditLogWriteParams {
    return {
        action: "CSRF_INVALID",
        actorUserId: params.actorUserId,
        actorUsername: params.actorUsername,
        targetUserId: null,
        targetUsername: null,
        details: {
            method: params.method,
            path: params.path,
            reason: "invalid_csrf_token",
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}

/**
 * 계정 상태 변경 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildAccountStatusChangedAuditLogWriteParams(params: AuditRequestMetaFields & {
    actorUserId: number;
    actorUsername: string | null;
    targetUserId: number;
    targetUsername: string;
    previousStatus: "active" | "inactive";
    currentStatus: "active" | "inactive";
}): AuditLogWriteParams {
    return {
        action: params.currentStatus === "active" ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
        actorUserId: params.actorUserId,
        actorUsername: params.actorUsername,
        targetUserId: params.targetUserId,
        targetUsername: params.targetUsername,
        details: {
            previousStatus: params.previousStatus,
            currentStatus: params.currentStatus,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}

/**
 * 관리자 권한 변경 이벤트 입력을 감사로그 쓰기 파라미터로 변환합니다.
 */
export function buildAdminRoleChangedAuditLogWriteParams(params: AuditRequestMetaFields & {
    actorUserId: number;
    actorUsername: string | null;
    targetUserId: number;
    targetUsername: string;
    previousRole: UserRole;
    currentRole: UserRole;
}): AuditLogWriteParams {
    return {
        action: params.currentRole === "admin" ? "ADMIN_GRANTED" : "ADMIN_REVOKED",
        actorUserId: params.actorUserId,
        actorUsername: params.actorUsername,
        targetUserId: params.targetUserId,
        targetUsername: params.targetUsername,
        details: {
            previousRole: params.previousRole,
            currentRole: params.currentRole,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    };
}
