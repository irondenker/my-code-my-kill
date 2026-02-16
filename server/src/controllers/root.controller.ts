import type { Request, Response } from "express";

/**
 * 루트 페이지(`/`)를 렌더링합니다.
 *
 * 현재는 랜딩 템플릿만 반환하며,
 * 인증/권한 처리는 라우트 미들웨어에서 담당합니다.
 */
export async function getRootPage(req: Request, res: Response) {
    return res.render("index");
}
