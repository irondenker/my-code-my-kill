import type { Request, Response, NextFunction } from 'express';
import fs from "node:fs";
import path from 'node:path';
import { getSafeRedirectPath } from "../utils/redirect.util.js";

const staticErrorStatuses = new Set([403, 404, 500, 503, 504]);
const sharedErrorPage = path.join(process.cwd(), "views", "errors", "common", "index.html");
const sharedTemplate = fs.readFileSync(sharedErrorPage, "utf8");

function renderSharedErrorPage(status: number, source: "app" | "app-fallback") {
    return sharedTemplate
        .replace(/__ERROR_CODE__/g, String(status))
        .replace(/__ERROR_SOURCE__/g, source);
}

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) console.error('[ERROR]', err);

    const status = typeof err?.status === 'number'
        ? err.status
        : 500;

    if (status === 401) {
        const nextPath = getSafeRedirectPath(req.originalUrl, "");
        if (nextPath && req.path !== "/login") {
            return res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
        }
        return res.redirect("/login");
    }

    const source = staticErrorStatuses.has(status) ? "app" : "app-fallback";
    const html = renderSharedErrorPage(status, source);
    return res.status(status).type("html").send(html);
}
