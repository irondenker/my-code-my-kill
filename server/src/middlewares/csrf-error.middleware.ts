import type { NextFunction, Request, Response } from 'express';
import { logCsrfInvalidSafely } from '../services/audit.service.js';
import { getRequestIp, getRequestUserAgent } from '../utils/http/request-meta.util.js';
import { HttpError } from '../utils/http/http-error.js';
import { getSessionActor } from '../utils/session/session-actor.util.js';

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
    if (err?.code !== 'EBADCSRFTOKEN') {
      return next(err);
    }

    const actor = getSessionActor(req);
    logCsrfInvalid({
      actorUserId: actor.userId,
      actorUsername: actor.username,
      method: req.method,
      path: req.originalUrl,
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    });

    // error-handler.ts에서 중복 감사 로그를 남기지 않도록 플래그 처리
    res.locals.securityEventLogged = true;
    return next(new HttpError(403, 'Invalid CSRF token'));
  };
}

export const csrfErrorMiddleware = createCsrfErrorMiddleware();
