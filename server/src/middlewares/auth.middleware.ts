import type { Request, Response, NextFunction } from "express";
import { getSafeRedirectPath } from "../utils/redirect.util.js";
import { renderError } from "../utils/render-error.util.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
        return renderError(res, 401, "Unauthorized");
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
