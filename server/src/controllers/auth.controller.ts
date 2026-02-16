import type { Request, Response } from "express";
import {
    findUserForLogin,
    createUserForRegister,
    findUserByUsernameForRegisterLookup,
} from "../services/auth.service.js";
import { findUserProfileById } from "../services/profile.service.js";
import { writeAdminAuditLogSafely } from "../services/audit.service.js";
import { hashPassword, verifyPassword } from "../utils/password.util.js";
import { getSafeRedirectPath } from "../utils/redirect.util.js";
import { isValidPassword, isValidUsername } from "../utils/auth.validation.js";
import { normalizeString } from "../utils/string.util.js";
import { getRequestIp, getRequestUserAgent } from "../utils/request-meta.util.js";
import { regenerateSession, saveSession } from "../utils/session.util.js";

/**
 * 인증(Auth) 컨트롤러입니다.
 *
 * 책임:
 * - 로그인/회원가입/로그아웃 HTTP 흐름 제어
 * - 세션 생성/재생성/파기 및 쿠키 처리
 * - 서비스 호출에 필요한 최소 파라미터 구성
 * - 성공/실패 감사로그 기록 호출(상세 DB 로직은 서비스가 담당)
 *
 * 주의:
 * - DB 접근은 `auth-core.service` / `profile.service`로 위임합니다.
 */

/**
 * 로그인/회원가입 뷰 렌더링 시 사용하는 옵션 타입입니다.
 * 컨트롤러 내부에서만 사용됩니다.
 */
type AuthRenderOptions = {
    formError?: string | null;
    nextPath?: string | null;
};

/**
 * 세션을 안전하게 파기합니다.
 *
 * @param req Express 요청 객체
 */
function destroySession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.destroy((err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

/**
 * 로그인 페이지를 렌더링합니다.
 *
 * @param res Express 응답 객체
 * @param options 뷰 옵션(에러 메시지, nextPath)
 */
function renderLogin(res: Response, options: AuthRenderOptions = {}) {
    return res.render("auth/sign-in", {
        formError: options.formError ?? null,
        nextPath: options.nextPath ?? null,
    });
}

/**
 * 회원가입 페이지를 렌더링합니다.
 *
 * @param res Express 응답 객체
 * @param options 뷰 옵션(에러 메시지)
 */
function renderRegister(res: Response, options: AuthRenderOptions = {}) {
    return res.render("auth/register", {
        formError: options.formError ?? null,
    });
}

/**
 * 로그인 페이지를 표시합니다.
 * `next` 쿼리 파라미터는 안전한 경로로만 허용합니다.
 */
export async function getLoginPage(req: Request, res: Response) {
    const nextPath = getSafeRedirectPath(req.query?.next, "");
    return renderLogin(res, { nextPath: nextPath || null });
}

/**
 * 회원가입 페이지를 표시합니다.
 */
export async function getRegisterPage(_req: Request, res: Response) {
    return renderRegister(res);
}

/**
 * 회원가입 요청을 처리합니다.
 *
 * 처리:
 * - 입력 검증(username/password)
 * - username 중복 검사
 * - 비밀번호 해시 후 계정 생성
 * - 세션 재생성(regenerate) 및 로그인 상태로 전환
 */
export async function postRegister(req: Request, res: Response) {
    const username = normalizeString(req.body?.username);
    const password = String(req.body?.password ?? "");

    if (!username) {
        return res.status(400).render("auth/register", {
            formError: "Username is required.",
        });
    }

    if (!password) {
        return res.status(400).render("auth/register", {
            formError: "Password is required.",
        });
    }

    if (!isValidUsername(username)) {
        return res.status(422).render("auth/register", {
            formError: "Username must be 3-50 characters.",
        });
    }

    if (!isValidPassword(password)) {
        return res.status(422).render("auth/register", {
            formError: "Password must be at least 8 characters.",
        });
    }

    const existing = await findUserByUsernameForRegisterLookup(username);
    if (existing) {
        return res.status(409).render("auth/register", {
            formError: "Username is already taken.",
        });
    }

    const passwordHash = hashPassword(password);
    const user = await createUserForRegister({ username, passwordHash });

    await regenerateSession(req);
    req.session.userId = user.userId;
    req.session.userRole = user.userRole;
    req.session.username = user.username;
    req.session.profileImageUrl = null;
    await saveSession(req);

    return res.redirect("/board");
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
    const username = normalizeString(req.body?.username);
    const password = String(req.body?.password ?? "");
    const nextFromBody = normalizeString(req.body?.next);
    const safeNextForView = getSafeRedirectPath(nextFromBody, "");
    const nextPath = getSafeRedirectPath(nextFromBody, "/board");
    const ipAddress = getRequestIp(req);
    const userAgent = getRequestUserAgent(req);

    if (!username || !password) {
        await writeAdminAuditLogSafely({
            action: "LOGIN_FAILED",
            actorUserId: null,
            actorUsername: username || null,
            targetUserId: null,
            targetUsername: username || null,
            details: {
                loginResult: "failure",
                reason: "missing_credentials",
                attemptedUsername: username || null,
            },
            ipAddress,
            userAgent,
        });
        return res.status(400).render("auth/sign-in", {
            formError: "Username and password are required.",
            nextPath: safeNextForView || null,
        });
    }

    const user = await findUserForLogin({
        username,
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
        await writeAdminAuditLogSafely({
            action: "LOGIN_FAILED",
            actorUserId: null,
            actorUsername: username,
            targetUserId: user?.userId ?? null,
            targetUsername: user?.username ?? username,
            details: {
                loginResult: "failure",
                reason: "invalid_credentials",
                attemptedUsername: username,
            },
            ipAddress,
            userAgent,
        });
        return res.status(401).render("auth/sign-in", {
            formError: "Invalid username or password.",
            nextPath: safeNextForView || null,
        });
    }
    if (!user.isActive) {
        await writeAdminAuditLogSafely({
            action: "LOGIN_FAILED",
            actorUserId: null,
            actorUsername: username,
            targetUserId: user.userId,
            targetUsername: user.username,
            details: {
                loginResult: "failure",
                reason: "inactive_account",
                attemptedUsername: username,
            },
            ipAddress,
            userAgent,
        });
        return res.status(403).render("auth/sign-in", {
            formError: "This account is inactive. Contact an administrator.",
            nextPath: safeNextForView || null,
        });
    }

    await regenerateSession(req);
    req.session.userId = user.userId;
    req.session.userRole = user.userRole;
    req.session.username = user.username;
    const profile = await findUserProfileById(user.userId);
    req.session.profileImageUrl = profile?.profileImageUrl ?? null;
    await saveSession(req);

    await writeAdminAuditLogSafely({
        action: "LOGIN",
        actorUserId: user.userId,
        actorUsername: user.username,
        targetUserId: user.userId,
        targetUsername: user.username,
        details: {
            loginResult: "success",
            userRole: user.userRole,
        },
        ipAddress,
        userAgent,
    });

    return res.redirect(nextPath);
}

/**
 * 로그아웃 요청을 처리합니다.
 *
 * 처리:
 * - (가능한 경우) 로그아웃 감사로그 기록
 * - 세션 파기 및 쿠키 제거
 */
export async function postLogout(req: Request, res: Response) {
    const userId = typeof req.session.userId === "number" ? req.session.userId : null;
    const role = req.session.userRole;
    const username = normalizeString(req.session.username);
    const ipAddress = getRequestIp(req);
    const userAgent = getRequestUserAgent(req);

    if (userId !== null) {
        await writeAdminAuditLogSafely({
            action: "LOGOUT",
            actorUserId: userId,
            actorUsername: username || null,
            targetUserId: userId,
            targetUsername: username || null,
            details: {
                logoutResult: "success",
                userRole: role ?? null,
            },
            ipAddress,
            userAgent,
        });
    }

    await destroySession(req);
    res.clearCookie("mcmk.sid");
    return res.redirect("/");
}
