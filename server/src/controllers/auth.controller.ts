import type { Request, Response, NextFunction } from "express";
import { createUser, findUserByUsername, findUserProfileById } from "../services/auth.service.js";
import { writeAdminAuditLog } from "../services/admin-audit.service.js";
import { hashPassword, verifyPassword } from "../utils/password.util.js";
import { getSafeRedirectPath } from "../utils/redirect.util.js";
import { isValidPassword, isValidUsername, normalizeString } from "../utils/auth.validation.js";
import { regenerateSession, saveSession } from "../utils/session.util.js";

type AuthRenderOptions = {
    formError?: string | null;
    nextPath?: string | null;
};

function getRequestIp(req: Request): string | null {
    const value = typeof req.ip === "string" ? req.ip.trim() : "";
    return value || null;
}

function getRequestUserAgent(req: Request): string | null {
    const value = req.get("user-agent");
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
}

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

async function writeAdminAuditLogSafely(
    params: Parameters<typeof writeAdminAuditLog>[0]
): Promise<void> {
    try {
        await writeAdminAuditLog(params);
    } catch (err) {
        // Audit logging must not break auth flow.
        console.error("[AUDIT_LOG_ERROR]", err);
    }
}

function renderLogin(res: Response, options: AuthRenderOptions = {}) {
    return res.render("auth/sign-in", {
        formError: options.formError ?? null,
        nextPath: options.nextPath ?? null,
    });
}

function renderRegister(res: Response, options: AuthRenderOptions = {}) {
    return res.render("auth/register", {
        formError: options.formError ?? null,
    });
}

export async function getLoginPage(req: Request, res: Response, next: NextFunction) {
    try {
        const nextPath = getSafeRedirectPath(req.query?.next, "");
        return renderLogin(res, { nextPath: nextPath || null });
    } catch (err) {
        return next(err);
    }
}

export async function getRegisterPage(req: Request, res: Response, next: NextFunction) {
    try {
        return renderRegister(res);
    } catch (err) {
        return next(err);
    }
}

export async function postRegister(req: Request, res: Response, next: NextFunction) {
    try {
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

        const existing = await findUserByUsername(username);
        if (existing) {
            return res.status(409).render("auth/register", {
                formError: "Username is already taken.",
            });
        }

        const passwordHash = hashPassword(password);
        const user = await createUser({ username, passwordHash });

        await regenerateSession(req);
        req.session.userId = user.userId;
        req.session.userRole = user.userRole;
        req.session.username = user.username;
        req.session.profileImageUrl = null;
        await saveSession(req);

        return res.redirect("/board");
    } catch (err) {
        return next(err);
    }
}

export async function postLogin(req: Request, res: Response, next: NextFunction) {
    try {
        const username = normalizeString(req.body?.username);
        const password = String(req.body?.password ?? "");
        const nextFromBody = normalizeString(req.body?.next);
        const safeNextForView = getSafeRedirectPath(nextFromBody, "");
        const nextPath = getSafeRedirectPath(nextFromBody, "/board");

        if (!username || !password) {
            return res.status(400).render("auth/sign-in", {
                formError: "Username and password are required.",
                nextPath: safeNextForView || null,
            });
        }

        const user = await findUserByUsername(username);
        if (!user || !verifyPassword(password, user.passwordHash)) {
            return res.status(401).render("auth/sign-in", {
                formError: "Invalid username or password.",
                nextPath: safeNextForView || null,
            });
        }
        if (!user.isActive) {
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
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
        });

        return res.redirect(nextPath);
    } catch (err) {
        return next(err);
    }
}

export async function postLogout(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = typeof req.session.userId === "number" ? req.session.userId : null;
        const role = req.session.userRole;
        const username = normalizeString(req.session.username);

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
                ipAddress: getRequestIp(req),
                userAgent: getRequestUserAgent(req),
            });
        }

        await destroySession(req);
        res.clearCookie("mcmk.sid");
        return res.redirect("/");
    } catch (err) {
        return next(err);
    }
}
