import type { Request, Response } from "express";
import { getSafeRedirectPath } from "../../utils/redirect.util.js";

type AuthRenderOptions = {
    formError?: string | null;
    nextPath?: string | null;
};

function renderLogin(res: Response, options: AuthRenderOptions = {}) {
    return res.render("auth/sign-in", {
        formError: options.formError ?? null,
        nextPath: options.nextPath ?? null,
    });
}

function renderRegister(res: Response, options: AuthRenderOptions = {}) {
    return res.render("auth/register", {
        formError: options.formError ?? null,
    });
}

/**
 * 로그인 페이지를 표시합니다.
 * `next` 쿼리 파라미터는 안전한 경로로만 허용합니다.
 */
export async function getLoginPage(req: Request, res: Response) {
    const nextPath = getSafeRedirectPath(req.query?.next, "");
    return renderLogin(res, { nextPath: nextPath || null });
}

/**
 * 회원가입 페이지를 표시합니다.
 */
export async function getRegisterPage(_req: Request, res: Response) {
    return renderRegister(res);
}
