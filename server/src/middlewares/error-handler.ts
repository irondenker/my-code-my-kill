import type { Request, Response, NextFunction } from 'express';
import fs from "node:fs";
import path from 'node:path';
import { getSafeRedirectPath } from "../utils/redirect.util.js";

const staticErrorStatuses = new Set([403, 404, 500, 503, 504]);
const fallbackErrorPage = path.join(process.cwd(), "views", "errors", "edge", "index.html");
const fallbackTemplate = fs.readFileSync(fallbackErrorPage, "utf8");

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

    if (staticErrorStatuses.has(status)) {
        const errorPage = path.join(process.cwd(), 'views', 'errors', String(status), 'index.html');
        return res.status(status).sendFile(errorPage);
    }

    const fallbackHtml = fallbackTemplate.replace("__ERROR_CODE__", String(status));
    return res.status(status).type("html").send(fallbackHtml);
}
