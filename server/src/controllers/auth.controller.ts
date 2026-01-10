import type { Request, Response, NextFunction } from "express";
import { createUser, findUserByUsername } from "../services/auth.service.ts";
import { hashPassword, verifyPassword } from "../utils/password.util.ts";
import { getSafeRedirectPath } from "../utils/redirect.util.ts";

type AuthRenderOptions = {
    formError?: string | null;
    nextPath?: string | null;
};

function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function isValidUsername(username: string): boolean {
    return username.length >= 3 && username.length <= 50;
}

function isValidPassword(password: string): boolean {
    return password.length >= 8 && password.length <= 128;
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

function regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

function saveSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.save((err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
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

        if (!isValidUsername(username)) {
            return res.status(400).render("auth/register", {
                formError: "Username must be 3-50 characters.",
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).render("auth/register", {
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

        await regenerateSession(req);
        req.session.userId = user.userId;
        req.session.userRole = user.userRole;
        req.session.username = user.username;
        await saveSession(req);

        return res.redirect(nextPath);
    } catch (err) {
        return next(err);
    }
}

export async function postLogout(req: Request, res: Response, next: NextFunction) {
    try {
        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }
            res.clearCookie("mcmk.sid");
            return res.redirect("/");
        });
    } catch (err) {
        return next(err);
    }
}
