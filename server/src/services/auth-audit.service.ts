import { writeAdminAuditLogSafely } from "./admin-audit.service.js";

import type { LoginFailedReason } from "../types/auth.types.js";

/**
 * 인증(Auth) 관련 감사로그를 기록하는 서비스입니다.
 * 컨트롤러에서 payload 구성 중복을 줄이기 위해 auth 전용 이벤트를 여기로 모읍니다.
 *
 * 규칙:
 * - 컨트롤러는 "언제/무엇을" 기록할지 결정하고, 이 서비스는 "어떤 형태로" 기록할지를 담당합니다.
 * - 콘솔 출력 여부는 `admin-audit.service`의 `AUDIT_CLI_LOG_LEVEL` 정책을 따릅니다.
 */

type AuthAuditBaseParams = {
    ipAddress: string | null;
    userAgent: string | null;
};

/**
 * Auth 감사로그 기록을 위한 공통 래퍼입니다.
 *
 * 역할:
 * - `writeAdminAuditLogSafely`에 넘길 payload의 공통 필드를 표준화합니다.
 * - 호출부에서 action/actor/target/details만 결정하면 되도록 단순화합니다.
 *
 * 주의:
 * - 이 함수는 실패해도 예외를 던지지 않습니다(감사로그 기록 실패가 인증 흐름을 깨면 안 됨).
 *
 * @param params 감사로그 공통/가변 필드
 */
async function writeAuthAuditSafely(params: {
    action: "LOGIN" | "LOGIN_FAILED" | "LOGOUT";
    actorUserId: number | null;
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    details: Record<string, unknown>;
} & AuthAuditBaseParams): Promise<void> {
    // 공통 필드(ip/userAgent)는 항상 포함하여, 운영 환경에서 사건 추적성을 유지합니다.
    await writeAdminAuditLogSafely({
        action: params.action,
        actorUserId: params.actorUserId,
        actorUsername: params.actorUsername,
        targetUserId: params.targetUserId,
        targetUsername: params.targetUsername,
        details: params.details,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

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
    // 로그인 실패 시점에는 실제 actor(userId)가 없으므로 actorUserId는 null로 기록합니다.
    // attemptedUsername은 actorUsername/targetUsername에 함께 남겨 검색 가능성을 높입니다.
    await writeAuthAuditSafely({
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
    // 로그인 성공은 actor와 target이 동일 사용자이므로 동일 값으로 저장합니다.
    await writeAuthAuditSafely({
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
    // 로그아웃은 세션 파기 직전에 기록하므로 username/userRole이 null일 수 있습니다.
    await writeAuthAuditSafely({
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
