import type { Request, Response } from "express";

/**
 * 루트 페이지 컨트롤러입니다.
 *
 * 컨트롤러는 req/res/next 흐름만 담당하고, 비즈니스 로직은 서비스/유틸로 위임합니다.
 */
export async function getRootPage(req: Request, res: Response) {
    return res.render("index");
}
