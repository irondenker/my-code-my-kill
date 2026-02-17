import type { Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { getSafeRedirectPath } from "../utils/http/redirect.util.js";
import { logAuthzDeniedSafely } from "../services/audit.service.js";
import { getRequestIp, getRequestUserAgent } from "../utils/http/request-meta.util.js";
import { getSessionActor } from "../utils/session/session-actor.util.js";

const staticErrorStatuses = new Set([403, 404, 500, 503, 504]);
const sharedErrorPage = path.join(process.cwd(), "views", "errors", "common", "index.html");
const sharedTemplate = fs.readFileSync(sharedErrorPage, "utf8");

/**
 * 권한 거부(403) 이벤트를 감사 로그에 안전하게 기록합니다.
 * 기록 실패가 에러 응답 처리 흐름을 중단시키지 않도록 예외를 내부 처리합니다.
 *
 * @param req Express 요청 객체
 * @param err 에러 객체
 */
function writeAuthzDeniedAuditLogSafely(req: Request, err: unknown) {
    const actor = getSessionActor(req);
    const reason =
        err instanceof Error
            ? err.message
            : typeof (err as { message?: unknown })?.message === "string"
                ? String((err as { message?: unknown }).message)
                : "forbidden";

    logAuthzDeniedSafely({
        actorUserId: actor.userId,
        actorUsername: actor.username,
        reason,
        method: req.method,
        path: req.originalUrl,
        ipAddress: getRequestIp(req),
        userAgent: getRequestUserAgent(req),
    });
}

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
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) {
        console.error("[ERROR]", err);
    }

    const status = typeof err?.status === "number" ? err.status : 500;

    if (status === 403 && !res.locals.securityEventLogged) {
        writeAuthzDeniedAuditLogSafely(req, err);
        res.locals.securityEventLogged = true;
    }

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
