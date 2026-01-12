import type { Request, Response, NextFunction } from "express";
import { getSafeRedirectPath } from "../utils/redirect.util.js";
import { HttpError } from "../utils/http-error.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
        return next(new HttpError(401, "Unauthorized"));
    }
    return next();
}

export function requireAuthRedirect(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
        const nextPath = getSafeRedirectPath(req.originalUrl, "");
        if (nextPath) {
            return res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
        }
        return res.redirect("/login");
    }
    return next();
}


