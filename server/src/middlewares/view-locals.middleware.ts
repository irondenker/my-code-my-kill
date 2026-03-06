import type { RequestHandler } from 'express';
import type { LabOptions } from '../config/lab-options.js';

/**
 * EJS 템플릿에서 공통으로 사용하는 `res.locals`를 세팅하는 미들웨어입니다.
 *
 * 책임:
 * - 세션 기반 사용자 정보/프로필 이미지 URL을 템플릿에 내려줍니다.
 * - `csurf`가 활성화된 경우 CSRF 토큰을 내려줍니다.
 * - Lab 옵션(취약점 실습 토글) 값을 템플릿에서 참조할 수 있도록 내려줍니다.
 */
export function createViewLocalsMiddleware(params: {
  labOptions: LabOptions;
  escapeForXss: (value: unknown) => string;
}): RequestHandler {
  return (req, res, next) => {
    res.locals.csrfToken =
      typeof (req as any).csrfToken === 'function' ? (req as any).csrfToken() : null;
    res.locals.sessionUser = req.session.userId ?? null;
    res.locals.sessionUsername = req.session.username ?? null;
    res.locals.sessionUserRole = req.session.userRole ?? null;

    res.locals.labStoredXssEnabled = params.labOptions.xssInjection.storedXss;
    res.locals.clientSideSanitizeEnabled =
      params.labOptions.xssInjection.clientSide.sanitizeEnabled;
    res.locals.serverSideSanitizeEnabled =
      params.labOptions.xssInjection.serverSide.sanitizeEnabled;
    res.locals.xssClientSideOptions = params.labOptions.xssInjection.clientSide;
    res.locals.escapeForXss = params.escapeForXss;

    const profileImageUrl = req.session.profileImageUrl;
    res.locals.sessionProfileImageUrl =
      profileImageUrl && typeof profileImageUrl === 'string' && !profileImageUrl.startsWith('/')
        ? `/uploads/avatars/${profileImageUrl}`
        : (profileImageUrl ?? null);

    next();
  };
}
