import type { Request, Response, NextFunction } from "express";
import { buildBoardIndexViewModel } from "../view-models/board.view-model.ts";

export async function getBoardIndex(req: Request, res: Response, next: NextFunction) {
    try {
        const viewModel = await buildBoardIndexViewModel(req);
        return res.render('board/index', viewModel);
    } catch (err) {
        return next(err); // 여기서 throw 하지 말고 에러 미들웨어로 넘기는 게 정석
    }
}