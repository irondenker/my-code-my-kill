import type { NextFunction, Request, RequestHandler, Response } from "express";
import csrf from "csurf";
import multer from "multer";
import { ARTICLE_IMAGE_MAX_BYTES } from "../constants/upload-article.constants.js";
import { AVATAR_IMAGE_MAX_BYTES } from "../constants/upload-avatar.constants.js";

/**
 * 전역 CSRF 보호 미들웨어 체인을 생성합니다.
 *
 * 목표:
 * - 일반 요청(urlencoded)은 `csurf`로 바로 검증합니다.
 * - multipart/form-data 요청은 `multer`가 먼저 body를 파싱해야 토큰(`_csrf`)을 읽을 수 있으므로,
 *   해당 경로에 한해 `multer -> csurf` 순서를 전역에서 보장합니다.
 *
 * 주의:
 * - 이 체인은 "라우트 단위"가 아니라 "경로 패턴"으로 multipart 여부를 판정합니다.
 *   라우트 경로/필드명이 바뀌면 여기 패턴도 함께 업데이트해야 합니다.
 */
export function createGlobalCsrfMiddlewares(options: { csrfLabEnabled: boolean }): RequestHandler[] {
    if (options.csrfLabEnabled) {
        return [];
    }

    const csrfProtection = csrf();

    // multer의 fileSize 제한은 "파싱 단계" 보호용입니다.
    // 각 도메인(아바타/게시글)은 컨트롤러/서비스에서 별도의 정책 검증을 추가로 수행할 수 있습니다.
    const MULTIPART_MAX_FILE_SIZE_BYTES = Math.max(ARTICLE_IMAGE_MAX_BYTES, AVATAR_IMAGE_MAX_BYTES);
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: MULTIPART_MAX_FILE_SIZE_BYTES },
    });

    const multipartPreParser: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
        // 인증이 안 된 요청은 라우터의 `requireAuthRedirect`에서 처리하도록 두고,
        // 여기서는 불필요한 multipart 파싱을 하지 않습니다.
        const sessionUserId = Number(req.session.userId);
        const isAuthenticated = Number.isFinite(sessionUserId) && sessionUserId > 0;

        if (req.method !== "POST") {
            return next();
        }

        if (req.path === "/users/avatar") {
            if (!isAuthenticated) {
                return next();
            }
            return upload.single("avatar")(req, res, next);
        }

        if (/^\/board\/[^/]+$/.test(req.path)) {
            if (!isAuthenticated) {
                return next();
            }
            return upload.fields([
                { name: "image", maxCount: 1 },
                { name: "attachment", maxCount: 1 },
            ])(req, res, next);
        }

        if (/^\/board\/[^/]+\/\d+\/edit$/.test(req.path)) {
            if (!isAuthenticated) {
                return next();
            }
            return upload.fields([
                { name: "image", maxCount: 1 },
                { name: "attachment", maxCount: 1 },
            ])(req, res, next);
        }

        return next();
    };

    return [multipartPreParser, csrfProtection];
}
