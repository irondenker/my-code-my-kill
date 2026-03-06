import type { Request, Response } from 'express';
import {
  findUserByUsername,
  recordLoginFailureAndRequirePasswordReset,
  resetLoginFailureState,
} from '../../services/auth.service.js';
import { findUserProfileById } from '../../services/profile.service.js';
import {
  logAccountLockedSafely,
  logLoginFailedSafely,
  logRateLimitedSafely,
  logLoginSuccessSafely,
} from '../../services/audit.service.js';
import { consumeFixedWindowRateLimit } from '../../services/security-defense/rate-limit.service.js';
import { getSecurityDefenseOptions } from '../../config/security-defense-options.js';
import { parseLoginForm } from '../../schemas/auth.schema.js';
import {
  clearLoginCaptchaState,
  recordLoginFailureForCaptcha,
  resolveLoginCaptchaViewModel,
  verifyLoginCaptchaAnswer,
} from '../../utils/auth/login-captcha.util.js';
import { verifyPassword } from '../../utils/password.util.js';
import { getSafeRedirectPath } from '../../utils/http/redirect.util.js';
import { normalizeString } from '../../utils/string.util.js';
import { getRequestIp, getRequestUserAgent } from '../../utils/http/request-meta.util.js';
import { establishAuthSession } from '../../utils/session/auth-session.util.js';

const GENERIC_LOGIN_FAILURE_MESSAGE =
  'Invalid username or password. If needed, use password reset.';

function renderLoginForm(
  req: Request,
  res: Response,
  params: {
    status: number;
    nextPath: string | null;
    formError: string;
    loginCaptchaEnabled: boolean;
  }
) {
  const captcha = resolveLoginCaptchaViewModel(req, params.loginCaptchaEnabled);
  return res.status(params.status).render('auth/sign-in', {
    formError: params.formError,
    nextPath: params.nextPath,
    captchaRequired: captcha.required,
    captchaQuestion: captcha.question,
  });
}

function isLoginTemporarilyLocked(user: { loginLockedUntil: Date | null }): boolean {
  return user.loginLockedUntil instanceof Date && user.loginLockedUntil.getTime() > Date.now();
}

/**
 * 로그인 요청을 처리합니다.
 *
 * 처리:
 * - 입력 검증
 * - 계정 조회/비밀번호 검증
 * - 비활성 계정 차단
 * - 세션 재생성(regenerate) 및 로그인 상태로 전환
 * - 성공/실패에 대한 감사로그 기록
 *
 * 참고:
 * - `next`는 open redirect 방지를 위해 `getSafeRedirectPath`로 제한합니다.
 */
export async function postLogin(req: Request, res: Response) {
  const rawUsername = normalizeString(req.body?.username);
  const rawNextFromBody = normalizeString(req.body?.next);
  const safeNextForView = getSafeRedirectPath(rawNextFromBody, '');
  const ipAddress = getRequestIp(req);
  const userAgent = getRequestUserAgent(req);
  const securityDefense = getSecurityDefenseOptions();
  const accountLockoutOptions = securityDefense.accountLockout;
  const accountLockoutEnabled = accountLockoutOptions.enabled;
  const rateLimitOptions = securityDefense.rateLimit;
  const loginSimpleCaptchaOptions = securityDefense.simpleCaptcha.login;

  if (rateLimitOptions.enabled) {
    const rateLimitKey = `${ipAddress ?? 'unknown'}:${(rawUsername || '').toLowerCase()}`;
    const rateLimitDecision = consumeFixedWindowRateLimit({
      bucket: 'login',
      key: rateLimitKey,
      maxRequests: rateLimitOptions.maxRequests,
      windowSeconds: rateLimitOptions.windowSeconds,
    });

    if (rateLimitDecision.limited) {
      await logRateLimitedSafely({
        actorUserId: null,
        actorUsername: rawUsername || null,
        targetUserId: null,
        targetUsername: rawUsername || null,
        scope: 'login',
        keyType: 'ip',
        maxRequests: rateLimitOptions.maxRequests,
        windowSeconds: rateLimitOptions.windowSeconds,
        retryAfterSeconds: rateLimitDecision.retryAfterSeconds,
        method: req.method,
        path: req.originalUrl,
        ipAddress,
        userAgent,
      });

      return renderLoginForm(req, res, {
        status: 429,
        nextPath: safeNextForView || null,
        formError: 'Too many login attempts. Please try again later.',
        loginCaptchaEnabled: loginSimpleCaptchaOptions.enabled,
      });
    }
  }

  const parsedLoginForm = parseLoginForm(req.body ?? {});
  const captchaPassed = verifyLoginCaptchaAnswer(req, req.body?.captchaAnswer);
  if (!captchaPassed) {
    await logLoginFailedSafely({
      actorUsername: rawUsername || null,
      targetUserId: null,
      targetUsername: rawUsername || null,
      attemptedUsername: rawUsername || null,
      reason: 'captcha_failed',
      ipAddress,
      userAgent,
    });
    return renderLoginForm(req, res, {
      status: 401,
      nextPath: safeNextForView || null,
      formError: GENERIC_LOGIN_FAILURE_MESSAGE,
      loginCaptchaEnabled: loginSimpleCaptchaOptions.enabled,
    });
  }

  if (!parsedLoginForm.success) {
    recordLoginFailureForCaptcha(req, {
      enabled: loginSimpleCaptchaOptions.enabled,
      afterFailures: loginSimpleCaptchaOptions.afterFailures,
    });
    await logLoginFailedSafely({
      actorUsername: rawUsername || null,
      targetUserId: null,
      targetUsername: rawUsername || null,
      attemptedUsername: rawUsername || null,
      reason: 'missing_credentials',
      ipAddress,
      userAgent,
    });
    return renderLoginForm(req, res, {
      status: 400,
      nextPath: safeNextForView || null,
      formError: 'Username and password are required.',
      loginCaptchaEnabled: loginSimpleCaptchaOptions.enabled,
    });
  }

  const { username, password, next } = parsedLoginForm.data;
  const nextPath = getSafeRedirectPath(next, '/');
  const user = await findUserByUsername(username);

  if (accountLockoutEnabled && user?.passwordResetRequired) {
    recordLoginFailureForCaptcha(req, {
      enabled: loginSimpleCaptchaOptions.enabled,
      afterFailures: loginSimpleCaptchaOptions.afterFailures,
    });
    await logLoginFailedSafely({
      actorUsername: username,
      targetUserId: user.userId,
      targetUsername: user.username,
      attemptedUsername: username,
      reason: 'password_reset_required',
      failedCount: user.loginFailedCount,
      passwordResetRequired: true,
      lockedUntil: user.loginLockedUntil,
      ipAddress,
      userAgent,
    });
    return renderLoginForm(req, res, {
      status: 401,
      nextPath: safeNextForView || null,
      formError: GENERIC_LOGIN_FAILURE_MESSAGE,
      loginCaptchaEnabled: loginSimpleCaptchaOptions.enabled,
    });
  }

  if (accountLockoutEnabled && user && isLoginTemporarilyLocked(user)) {
    recordLoginFailureForCaptcha(req, {
      enabled: loginSimpleCaptchaOptions.enabled,
      afterFailures: loginSimpleCaptchaOptions.afterFailures,
    });
    await logLoginFailedSafely({
      actorUsername: username,
      targetUserId: user.userId,
      targetUsername: user.username,
      attemptedUsername: username,
      reason: 'account_locked',
      failedCount: user.loginFailedCount,
      passwordResetRequired: user.passwordResetRequired,
      lockedUntil: user.loginLockedUntil,
      ipAddress,
      userAgent,
    });
    return renderLoginForm(req, res, {
      status: 401,
      nextPath: safeNextForView || null,
      formError: GENERIC_LOGIN_FAILURE_MESSAGE,
      loginCaptchaEnabled: loginSimpleCaptchaOptions.enabled,
    });
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordLoginFailureForCaptcha(req, {
      enabled: loginSimpleCaptchaOptions.enabled,
      afterFailures: loginSimpleCaptchaOptions.afterFailures,
    });
    let failedCount: number | null = null;
    let passwordResetRequired: boolean | null = null;
    let lockedUntil: Date | null = null;

    if (accountLockoutEnabled && user) {
      const defenseState = await recordLoginFailureAndRequirePasswordReset({
        userId: user.userId,
        maxFailures: accountLockoutOptions.maxFailures,
        useLoginLockUntil: accountLockoutOptions.useLoginLockUntil,
        lockMinutes: accountLockoutOptions.lockMinutes,
      });

      failedCount = defenseState.loginFailedCount;
      passwordResetRequired = defenseState.passwordResetRequired;
      lockedUntil = defenseState.loginLockedUntil;

      if (!user.passwordResetRequired && defenseState.passwordResetRequired) {
        await logAccountLockedSafely({
          targetUserId: user.userId,
          targetUsername: user.username,
          failedCount: defenseState.loginFailedCount,
          lockMinutes: accountLockoutOptions.useLoginLockUntil
            ? accountLockoutOptions.lockMinutes
            : null,
          ipAddress,
          userAgent,
        });
      }
    }

    await logLoginFailedSafely({
      actorUsername: username,
      targetUserId: user?.userId ?? null,
      targetUsername: user?.username ?? username,
      attemptedUsername: username,
      reason: 'invalid_credentials',
      failedCount,
      passwordResetRequired,
      lockedUntil,
      ipAddress,
      userAgent,
    });
    return renderLoginForm(req, res, {
      status: 401,
      nextPath: safeNextForView || null,
      formError: GENERIC_LOGIN_FAILURE_MESSAGE,
      loginCaptchaEnabled: loginSimpleCaptchaOptions.enabled,
    });
  }

  if (!user.isActive) {
    recordLoginFailureForCaptcha(req, {
      enabled: loginSimpleCaptchaOptions.enabled,
      afterFailures: loginSimpleCaptchaOptions.afterFailures,
    });
    await logLoginFailedSafely({
      actorUsername: username,
      targetUserId: user.userId,
      targetUsername: user.username,
      attemptedUsername: username,
      reason: 'inactive_account',
      ipAddress,
      userAgent,
    });
    return renderLoginForm(req, res, {
      status: 403,
      nextPath: safeNextForView || null,
      formError: 'This account is inactive. Contact an administrator.',
      loginCaptchaEnabled: loginSimpleCaptchaOptions.enabled,
    });
  }

  if (accountLockoutEnabled && (user.loginFailedCount > 0 || user.loginLockedUntil !== null)) {
    await resetLoginFailureState(user.userId);
  }

  const profile = await findUserProfileById(user.userId);
  await establishAuthSession(req, {
    userId: user.userId,
    userRole: user.userRole,
    username: user.username,
    profileImageUrl: profile?.profileImageUrl ?? null,
  });
  clearLoginCaptchaState(req);

  await logLoginSuccessSafely({
    userId: user.userId,
    username: user.username,
    userRole: user.userRole,
    ipAddress,
    userAgent,
  });

  return res.redirect(nextPath);
}
