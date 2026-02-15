import type { RequestHandler } from "express";
import express from "express";
import path from "node:path";

/**
 * 정적 파일(static) 제공 관련 미들웨어를 생성합니다.
 *
 * 역할:
 * - `/public` 아래의 정적 리소스를 제공합니다.
 * - 업로드된 첨부파일은 브라우저에서 inline 렌더링되지 않도록 다운로드로 강제합니다.
 * - 에러 페이지의 공통 정적 리소스를 제공합니다(`/errors/common`).
 */

/**
 * `/public` 정적 리소스 제공 미들웨어를 생성합니다.
 *
 * 보안 헤더:
 * - `X-Content-Type-Options: nosniff`
 *
 * 첨부파일 다운로드 강제:
 * - `public/uploads/posts/files/**` 경로는 `Content-Disposition: attachment`로 강제합니다.
 *
 * @param params.publicDir 프로젝트의 public 디렉토리 절대 경로
 */
export function createPublicStaticMiddleware(params: { publicDir: string }): RequestHandler {
    const postFileUploadDir = path.join(params.publicDir, "uploads", "posts", "files");

    return express.static(params.publicDir, {
        setHeaders(res, filePath) {
            // Helps prevent content-type sniffing attacks against uploaded files.
            res.setHeader("X-Content-Type-Options", "nosniff");

            // Force attachments to download instead of rendering inline in the browser.
            if (filePath.startsWith(postFileUploadDir + path.sep)) {
                const filename = path.basename(filePath);
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            }
        },
    });
}

/**
 * `/errors/common` 아래의 정적 리소스 제공 미들웨어를 생성합니다.
 *
 * 보안 헤더:
 * - `X-Content-Type-Options: nosniff`
 *
 * @param params.errorStaticRoot `<project>/views/errors` 디렉토리 절대 경로
 */
export function createErrorCommonStaticMiddleware(params: { errorStaticRoot: string }): RequestHandler {
    return express.static(path.join(params.errorStaticRoot, "common"), {
        setHeaders(res) {
            res.setHeader("X-Content-Type-Options", "nosniff");
        },
    });
}

