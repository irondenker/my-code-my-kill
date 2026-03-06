import type { Request, Response } from 'express';
import { getSecurityDefenseOptions } from '../../config/security-defense-options.js';
import { resolveLoginCaptchaViewModel } from '../../utils/auth/login-captcha.util.js';
import { getSafeRedirectPath } from '../../utils/http/redirect.util.js';

type AuthRenderOptions = {
  formError?: string | null;
  nextPath?: string | null;
  captchaRequired?: boolean;
  captchaQuestion?: string | null;
};

function renderLogin(res: Response, options: AuthRenderOptions = {}) {
  return res.render('auth/sign-in', {
    formError: options.formError ?? null,
    nextPath: options.nextPath ?? null,
    captchaRequired: options.captchaRequired ?? false,
    captchaQuestion: options.captchaQuestion ?? null,
  });
}

function renderRegister(res: Response, options: AuthRenderOptions = {}) {
  return res.render('auth/register', {
    formError: options.formError ?? null,
  });
}

/**
 * 로그인 페이지를 표시합니다.
 * `next` 쿼리 파라미터는 안전한 경로로만 허용합니다.
 */
export async function getLoginPage(req: Request, res: Response) {
  const nextPath = getSafeRedirectPath(req.query?.next, '');
  const simpleCaptchaOptions = getSecurityDefenseOptions().simpleCaptcha.login;
  const captcha = resolveLoginCaptchaViewModel(req, simpleCaptchaOptions.enabled);
  return renderLogin(res, {
    nextPath: nextPath || null,
    captchaRequired: captcha.required,
    captchaQuestion: captcha.question,
  });
}

/**
 * 회원가입 페이지를 표시합니다.
 */
export async function getRegisterPage(_req: Request, res: Response) {
  return renderRegister(res);
}
