import type { Request, Response, NextFunction } from "express";

/* 로그인 관련 Controller */
export async function getLoginPage(req: Request, res: Response, next: NextFunction) {
    try {
        return res.render('auth/sign-in');
    } catch (err) {
        return next(err);
    }
}

/* 회원가입 관련 Controller */
export async function getRegisterPage(req: Request, res: Response, next: NextFunction) {
    try {
        return res.render('auth/register');
    } catch (err) {
        return next(err);
    }
}