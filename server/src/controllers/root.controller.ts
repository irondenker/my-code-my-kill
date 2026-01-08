import type { Request, Response, NextFunction } from "express";

/* 로그인 관련 Controller */
export async function getRootPage(req: Request, res: Response, next: NextFunction) {
    try {
        return res.render('index');
    } catch (err) {
        return next(err);
    }
}