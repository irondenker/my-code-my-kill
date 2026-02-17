import type { NextFunction, Request, Response } from "express";
import { logCsrfInvalidSafely } from "../services/audit.service.js";
import { getRequestIp, getRequestUserAgent } from "../utils/request-meta.util.js";
import { HttpError } from "../utils/http-error.js";

/**
 * `csurf`가 던지는 EBADCSRFTOKEN을 403 HttpError로 변환하고,
 * 감사 로그(CSRF_INVALID)를 남깁니다.
 *
 * 이 미들웨어는 `errorHandler`보다 먼저 등록되어야 합니다.
 */
type LogCsrfInvalid = (params: Parameters<typeof logCsrfInvalidSafely>[0]) => void;

export function createCsrfErrorMiddleware(params?: { logCsrfInvalid?: LogCsrfInvalid }) {
    const logCsrfInvalid = params?.logCsrfInvalid ?? logCsrfInvalidSafely;

    return (err: any, req: Request, res: Response, next: NextFunction) => {
        if (err?.code !== "EBADCSRFTOKEN") {
            return next(err);
        }

        logCsrfInvalid({
            actorUserId: typeof req.session.userId === "number" ? req.session.userId : null,
            actorUsername: typeof req.session.username === "string" ? req.session.username : null,
            method: req.method,
            path: req.originalUrl,
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
        });

        // error-handler.ts에서 중복 감사 로그를 남기지 않도록 플래그 처리
        res.locals.securityEventLogged = true;
        return next(new HttpError(403, "Invalid CSRF token"));
    };
}

export const csrfErrorMiddleware = createCsrfErrorMiddleware();
