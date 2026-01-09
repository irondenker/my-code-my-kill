import type { Request, Response, NextFunction } from "express";

export async function getMypage(req: Request, res: Response, next: NextFunction) {
    try {
        return res.render('mypage/index');
    } catch (err) {
        return next(err);
    }
}