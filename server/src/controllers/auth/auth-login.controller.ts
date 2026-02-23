import type { Request, Response } from "express";
import {
    findUserByUsername,
    recordLoginFailureAndRequirePasswordReset,
    resetLoginFailureState,
} from "../../services/auth.service.js";
import { findUserProfileById } from "../../services/profile.service.js";
import {
    logAccountLockedSafely,
    logLoginFailedSafely,
    logLoginSuccessSafely,
} from "../../services/audit.service.js";
import { getSecurityDefenseOptions } from "../../config/security-defense-options.js";
import { parseLoginForm } from "../../schemas/auth.schema.js";
import { verifyPassword } from "../../utils/password.util.js";
import { getSafeRedirectPath } from "../../utils/http/redirect.util.js";
import { normalizeString } from "../../utils/string.util.js";
import { getRequestIp, getRequestUserAgent } from "../../utils/http/request-meta.util.js";
import { establishAuthSession } from "../../utils/session/auth-session.util.js";

const GENERIC_LOGIN_FAILURE_MESSAGE = "Invalid username or password. If needed, use password reset.";

function renderLoginFailure(res: Response, params: { status: number; nextPath: string | null }) {
    return res.status(params.status).render("auth/sign-in", {
        formError: GENERIC_LOGIN_FAILURE_MESSAGE,
        nextPath: params.nextPath,
    });
}

function isLoginTemporarilyLocked(user: { loginLockedUntil: Date | null }): boolean {
    return user.loginLockedUntil instanceof Date && user.loginLockedUntil.getTime() > Date.now();
}

/**
 * 로그인 요청을 처리합니다.
 *
 * 처리:
 * - 입력 검증
 * - 계정 조회/비밀번호 검증
 * - 비활성 계정 차단
 * - 세션 재생성(regenerate) 및 로그인 상태로 전환
 * - 성공/실패에 대한 감사로그 기록
 *
 * 참고:
 * - `next`는 open redirect 방지를 위해 `getSafeRedirectPath`로 제한합니다.
 */
export async function postLogin(req: Request, res: Response) {
    const rawUsername = normalizeString(req.body?.username);
    const rawNextFromBody = normalizeString(req.body?.next);
    const safeNextForView = getSafeRedirectPath(rawNextFromBody, "");
    const ipAddress = getRequestIp(req);
    const userAgent = getRequestUserAgent(req);

    const parsedLoginForm = parseLoginForm(req.body ?? {});
    if (!parsedLoginForm.success) {
        await logLoginFailedSafely({
            actorUsername: rawUsername || null,
            targetUserId: null,
            targetUsername: rawUsername || null,
            attemptedUsername: rawUsername || null,
            reason: "missing_credentials",
            ipAddress,
            userAgent,
        });
        return res.status(400).render("auth/sign-in", {
            formError: "Username and password are required.",
            nextPath: safeNextForView || null,
        });
    }
    const { username, password, next } = parsedLoginForm.data;
    const nextPath = getSafeRedirectPath(next, "/board");
    const securityDefense = getSecurityDefenseOptions();
    const accountLockoutOptions = securityDefense.accountLockout;
    const accountLockoutEnabled = accountLockoutOptions.enabled;

    const user = await findUserByUsername(username);

    if (accountLockoutEnabled && user?.passwordResetRequired) {
        await logLoginFailedSafely({
            actorUsername: username,
            targetUserId: user.userId,
            targetUsername: user.username,
            attemptedUsername: username,
            reason: "password_reset_required",
            failedCount: user.loginFailedCount,
            passwordResetRequired: true,
            lockedUntil: user.loginLockedUntil,
            ipAddress,
            userAgent,
        });
        return renderLoginFailure(res, {
            status: 401,
            nextPath: safeNextForView || null,
        });
    }

    if (accountLockoutEnabled && user && isLoginTemporarilyLocked(user)) {
        await logLoginFailedSafely({
            actorUsername: username,
            targetUserId: user.userId,
            targetUsername: user.username,
            attemptedUsername: username,
            reason: "account_locked",
            failedCount: user.loginFailedCount,
            passwordResetRequired: user.passwordResetRequired,
            lockedUntil: user.loginLockedUntil,
            ipAddress,
            userAgent,
        });
        return renderLoginFailure(res, {
            status: 401,
            nextPath: safeNextForView || null,
        });
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
        let failedCount: number | null = null;
        let passwordResetRequired: boolean | null = null;
        let lockedUntil: Date | null = null;

        if (accountLockoutEnabled && user) {
            const defenseState = await recordLoginFailureAndRequirePasswordReset({
                userId: user.userId,
                maxFailures: accountLockoutOptions.maxFailures,
                useLoginLockUntil: accountLockoutOptions.useLoginLockUntil,
                lockMinutes: accountLockoutOptions.lockMinutes,
            });

            failedCount = defenseState.loginFailedCount;
            passwordResetRequired = defenseState.passwordResetRequired;
            lockedUntil = defenseState.loginLockedUntil;

            if (!user.passwordResetRequired && defenseState.passwordResetRequired) {
                await logAccountLockedSafely({
                    targetUserId: user.userId,
                    targetUsername: user.username,
                    failedCount: defenseState.loginFailedCount,
                    lockMinutes: accountLockoutOptions.useLoginLockUntil ? accountLockoutOptions.lockMinutes : null,
                    ipAddress,
                    userAgent,
                });
            }
        }

        await logLoginFailedSafely({
            actorUsername: username,
            targetUserId: user?.userId ?? null,
            targetUsername: user?.username ?? username,
            attemptedUsername: username,
            reason: "invalid_credentials",
            failedCount,
            passwordResetRequired,
            lockedUntil,
            ipAddress,
            userAgent,
        });
        return renderLoginFailure(res, {
            status: 401,
            nextPath: safeNextForView || null,
        });
    }

    if (!user.isActive) {
        await logLoginFailedSafely({
            actorUsername: username,
            targetUserId: user.userId,
            targetUsername: user.username,
            attemptedUsername: username,
            reason: "inactive_account",
            ipAddress,
            userAgent,
        });
        return res.status(403).render("auth/sign-in", {
            formError: "This account is inactive. Contact an administrator.",
            nextPath: safeNextForView || null,
        });
    }

    if (accountLockoutEnabled && (user.loginFailedCount > 0 || user.loginLockedUntil !== null)) {
        await resetLoginFailureState(user.userId);
    }

    const profile = await findUserProfileById(user.userId);
    await establishAuthSession(req, {
        userId: user.userId,
        userRole: user.userRole,
        username: user.username,
        profileImageUrl: profile?.profileImageUrl ?? null,
    });

    await logLoginSuccessSafely({
        userId: user.userId,
        username: user.username,
        userRole: user.userRole,
        ipAddress,
        userAgent,
    });

    return res.redirect(nextPath);
}
