import type { Request, Response } from "express";

/**
 * 현재 요청에서 사용할 CSRF 토큰을 반환합니다.
 * CSRF 미들웨어가 적용되지 않은 라우트이거나 토큰 생성 함수가 없으면 null을 반환합니다.
 */
function getCsrfToken(req: Request): string | null {
    return typeof req.csrfToken === "function" ? req.csrfToken() : null;
}

/**
 * 게시글 작성 폼을 렌더링합니다.
 * 오류가 있는 경우 title/content를 함께 바인딩하여 재표시합니다.
 */
export function renderBoardCreate(
    req: Request,
    res: Response,
    params: {
        boardSlug: string;
        boardDisplayName: string;
        formError: string | null;
        title?: string;
        content?: string;
    }
) {
    return res.render("board/new", {
        boardSlug: params.boardSlug,
        boardDisplayName: params.boardDisplayName,
        formError: params.formError,
        title: params.title,
        content: params.content,
        csrfToken: getCsrfToken(req),
    });
}

/**
 * 게시글 수정 폼을 렌더링합니다.
 * 오류가 있는 경우 title/content와 현재 업로드 상태(이미지/첨부)를 함께 바인딩하여 재표시합니다.
 */
export function renderBoardEdit(
    req: Request,
    res: Response,
    params: {
        boardSlug: string;
        boardDisplayName: string;
        displayId: number;
        title: string;
        content: string;
        imageUrl: string | null;
        imageName: string | null;
        fileUrl: string | null;
        fileName: string | null;
        formError: string | null;
    }
) {
    return res.render("board/edit", {
        boardSlug: params.boardSlug,
        boardDisplayName: params.boardDisplayName,
        displayId: params.displayId,
        title: params.title,
        content: params.content,
        imageUrl: params.imageUrl,
        imageName: params.imageName,
        fileUrl: params.fileUrl,
        fileName: params.fileName,
        formError: params.formError,
        csrfToken: getCsrfToken(req),
    });
}

