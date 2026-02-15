import type { Request, Response, NextFunction } from "express";
import { getSafeRedirectPath } from "../utils/redirect.util.js";
import { HttpError } from "../utils/http-error.js";
import { writeAdminAuditLog } from "../services/admin-audit.service.js";

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
 * 관리자 페이지 접근 시도 이벤트를 감사 로그에 안전하게 기록합니다.
 * 로깅 실패가 요청 처리를 중단시키지 않도록 fire-and-forget 방식으로 동작합니다.
 *
 * @param req Express 요청 객체
 * @param params 접근 시도 결과와 사유
 */
function writeAdminAccessAttemptLogSafely(
    req: Request,
    params: { result: "allowed" | "redirect_login" | "forbidden"; reason: string }
) {
    void writeAdminAuditLog({
        action: "ADMIN_PAGE_ACCESS_ATTEMPT",
        actorUserId: typeof req.session.userId === "number" ? req.session.userId : null,
        actorUsername: typeof req.session.username === "string" ? req.session.username : null,
        targetUserId: null,
        targetUsername: null,
        details: {
            result: params.result,
            reason: params.reason,
            method: req.method,
            path: req.originalUrl,
        },
        ipAddress: getRequestIp(req),
        userAgent: getRequestUserAgent(req),
    }).catch((err) => {
        console.error(
            `[AUDIT_LOG_ERROR] action=ADMIN_PAGE_ACCESS_ATTEMPT path=${req.originalUrl} reason="${summarizeErrorMessage(err)}"`
        );
    });
}

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

export function requireAdminRedirect(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
        writeAdminAccessAttemptLogSafely(req, {
            result: "redirect_login",
            reason: "unauthenticated",
        });

        const nextPath = getSafeRedirectPath(req.originalUrl, "");
        if (nextPath) {
            return res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
        }
        return res.redirect("/login");
    }

    if (req.session.userRole !== "admin") {
        writeAdminAccessAttemptLogSafely(req, {
            result: "forbidden",
            reason: "admin_role_required",
        });
        res.locals.securityEventLogged = true;
        return next(new HttpError(403, "Forbidden"));
    }

    writeAdminAccessAttemptLogSafely(req, {
        result: "allowed",
        reason: "admin_role_verified",
    });
    return next();
}
