import type { Request, Response, NextFunction } from "express";
import { getSafeRedirectPath } from "../utils/redirect.util.ts";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
        return res.status(401).send("Unauthorized");
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
