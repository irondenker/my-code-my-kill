import type { Request, Response } from "express";
import { findUserByUsername } from "../../services/auth.service.js";
import { findUserProfileById } from "../../services/profile.service.js";
import {
    logLoginFailedSafely,
    logLoginSuccessSafely,
} from "../../services/audit.service.js";
import { parseLoginForm } from "../../schemas/auth.schema.js";
import { verifyPassword } from "../../utils/password.util.js";
import { getSafeRedirectPath } from "../../utils/redirect.util.js";
import { normalizeString } from "../../utils/string.util.js";
import { getRequestIp, getRequestUserAgent } from "../../utils/request-meta.util.js";
import { establishAuthSession } from "../../utils/auth-session.util.js";

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

    const user = await findUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        await logLoginFailedSafely({
            actorUsername: username,
            targetUserId: user?.userId ?? null,
            targetUsername: user?.username ?? username,
            attemptedUsername: username,
            reason: "invalid_credentials",
            ipAddress,
            userAgent,
        });
        return res.status(401).render("auth/sign-in", {
            formError: "Invalid username or password.",
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
