import type { Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { getSafeRedirectPath } from "../utils/redirect.util.js";
import { writeAdminAuditLog } from "../services/admin-audit.service.js";

const staticErrorStatuses = new Set([403, 404, 500, 503, 504]);
const sharedErrorPage = path.join(process.cwd(), "views", "errors", "common", "index.html");
const sharedTemplate = fs.readFileSync(sharedErrorPage, "utf8");

/**
 * 요청 IP를 문자열로 정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 IP 문자열 또는 null
 */
function getRequestIp(req: Request): string | null {
    const value = typeof req.ip === "string" ? req.ip.trim() : "";
    return value || null;
}

/**
 * 요청 User-Agent를 문자열로 정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 User-Agent 문자열 또는 null
 */
function getRequestUserAgent(req: Request): string | null {
    const value = req.get("user-agent");
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
}

function summarizeErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const compact = raw.replace(/\s+/g, " ").trim();
    return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

/**
 * 권한 거부(403) 이벤트를 감사 로그에 안전하게 기록합니다.
 * 기록 실패가 에러 응답 처리 흐름을 중단시키지 않도록 예외를 내부 처리합니다.
 *
 * @param req Express 요청 객체
 * @param err 에러 객체
 */
function writeAuthzDeniedAuditLogSafely(req: Request, err: unknown) {
    const reason =
        err instanceof Error
            ? err.message
            : typeof (err as { message?: unknown })?.message === "string"
                ? String((err as { message?: unknown }).message)
                : "forbidden";

    void writeAdminAuditLog({
        action: "AUTHZ_DENIED",
        actorUserId: typeof req.session.userId === "number" ? req.session.userId : null,
        actorUsername: typeof req.session.username === "string" ? req.session.username : null,
        targetUserId: null,
        targetUsername: null,
        details: {
            method: req.method,
            path: req.originalUrl,
            reason,
        },
        ipAddress: getRequestIp(req),
        userAgent: getRequestUserAgent(req),
    }).catch((logErr) => {
        console.error(
            `[AUDIT_LOG_ERROR] action=AUTHZ_DENIED path=${req.originalUrl} reason="${summarizeErrorMessage(logErr)}"`
        );
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
