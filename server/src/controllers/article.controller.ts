import type { Request, Response } from "express";
import path from "node:path";
import { HttpError } from "../utils/http-error.js";
import {
    buildViewerContext,
    getBoardReadAccessResult,
    getBoardCreateAccessResult,
} from "../utils/board.policy.util.js";
import {
    canDeleteArticle,
    canEditArticle,
    canReadArticleForBoard,
    getBoardWritePolicy,
} from "../utils/article.policy.util.js";
import { isValidArticleContent, isValidArticleTitle } from "../utils/article-validation.util.js";
import { buildMediaUrl } from "../utils/media-url.util.js";
import { ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH, ARTICLE_IMAGE_PUBLIC_BASE_PATH } from "../constants/upload-article.constants.js";
import { getPositiveIntParamOrThrow, getStringParamOrThrow } from "../utils/route-param.util.js";
import {
    createBoardArticle,
    doesArticleExistBySlugDisplayId,
    findBoardBySlug,
    findBoardArticleForShowBySlugDisplayId,
    findNeighborArticles,
    findArticleBySlugDisplayId,
    deleteStoredArticleAttachment,
    deleteStoredArticleImage,
    storeArticleAttachment,
    storeArticleImage,
    softDeleteArticleBySlugDisplayId,
    softDeleteArticleBySlugDisplayIdAsAdmin,
    updateBoardArticle,
} from "../services/board.service.js";

/**
 * 게시글 컨트롤러입니다.
 *
 * 원칙:
 * - 컨트롤러는 HTTP 흐름(req/res/session/redirect/render)만 담당합니다.
 * - 순수 판정/정규화는 `utils`로, DB/파일 I/O는 `services`로 위임합니다.
 */

/**
 * multer 업로드 결과(`req.files`)에서 특정 필드의 첫 파일을 추출합니다.
 * `array`/`fields` 형태를 모두 지원하며, 파일이 없으면 null을 반환합니다.
 */
function getUploadedFile(req: Request, fieldName: string): Express.Multer.File | null {
    const files = req.files;
    if (!files) {
        return null;
    }
    if (Array.isArray(files)) {
        return files.find((file) => file.fieldname === fieldName) ?? null;
    }
    const fieldFiles = files[fieldName];
    return fieldFiles?.[0] ?? null;
}

type StoredUploads = {
    imageUrl: string | null;
    fileUrl: string | null;
};

/**
 * 요청에 포함된 업로드(image/attachment)를 저장합니다.
 *
 * - 저장 중 하나라도 실패하면, 이미 저장된 파일도 best-effort로 정리한 뒤 에러를 다시 던집니다.
 * - 성공 시 저장된 경로(또는 null)를 반환합니다.
 */
async function storeArticleUploads(req: Request): Promise<StoredUploads> {
    const imageFile = getUploadedFile(req, "image");
    const attachmentFile = getUploadedFile(req, "attachment");
    let imageUrl: string | null = null;
    let fileUrl: string | null = null;

    try {
        if (imageFile) {
            imageUrl = await storeArticleImage(imageFile);
        }
        if (attachmentFile) {
            fileUrl = await storeArticleAttachment(attachmentFile);
        }
        return { imageUrl, fileUrl };
    } catch (err) {
        await cleanupArticleUploads({ imageUrl, fileUrl });
        throw err;
    }
}

/**
 * 저장된 업로드 파일을 best-effort로 정리합니다.
 * (파일이 null이거나 이미 삭제된 경우도 안전해야 합니다.)
 */
async function cleanupArticleUploads(uploads: StoredUploads): Promise<void> {
    await Promise.all([deleteStoredArticleImage(uploads.imageUrl), deleteStoredArticleAttachment(uploads.fileUrl)]);
}

/**
 * slug로 보드를 조회하고, 없으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
async function requireBoardBySlug(slug: string) {
    const board = await findBoardBySlug(slug);
    if (!board) {
        throw new HttpError(404, "Not Found");
    }
    return board;
}

/**
 * slug/displayId로 게시글을 조회하고, 없으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
async function requirePostBySlugDisplayId(params: { slug: string; displayId: number }) {
    const post = await findArticleBySlugDisplayId(params);
    if (!post) {
        throw new HttpError(404, "Not Found");
    }
    return post;
}

/**
 * 게시글 작성 폼(`/board/:slug/new`)을 렌더링합니다.
 * 보드 createAccess 정책에 따라 401 redirect 또는 403을 반환할 수 있습니다.
 */
export async function getArticleCreateForm(req: Request, res: Response) {
    // 1) 대상 보드를 확인하고, slug가 유효하지 않거나 보드가 없으면 404로 처리합니다.
    const slug = getStringParamOrThrow(req, "slug");
    const board = await requireBoardBySlug(slug);

    // 2) createAccess 정책을 평가해 로그인 유도/권한 거부를 분기합니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const createAccess = getBoardCreateAccessResult(board, viewerContext);
    if (createAccess === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }
    if (createAccess === "redirect_login") {
        return res.status(401).redirect("/login");
    }

    // 3) 접근 가능한 경우 빈 작성 폼을 렌더링합니다.
    return res.render("board/new", { boardSlug: board.slug, boardDisplayName: board.name, formError: null });
}

/**
 * 게시글 작성 요청(`/board/:slug`)을 처리합니다.
 *
 * 처리:
 * - createAccess 권한 체크
 * - title/content 검증
 * - (옵션) 이미지/첨부 업로드 저장
 * - 게시글 생성(DB) 후 상세 페이지로 이동
 */
export async function postArticleCreate(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const board = await requireBoardBySlug(slug);

    // 1) 보드 createAccess 정책에 따라 생성 가능 여부를 판정합니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const createAccess = getBoardCreateAccessResult(board, viewerContext);
    if (createAccess === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }
    if (createAccess === "redirect_login") {
        return res.status(401).redirect("/login");
    }

    // 2) 여기서부터는 "인증된 사용자"가 전제입니다.
    if (!Number.isFinite(viewerContext.viewerUserId) || viewerContext.viewerUserId <= 0) {
        throw new HttpError(401, "Unauthorized");
    }

    // 3) 입력값을 정규화/검증합니다.
    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();

    if (!title || !content) {
        res.status(400);
        return res.render("board/new", {
            boardSlug: board.slug,
            boardDisplayName: board.name,
            formError: "Title and content are required.",
            title,
            content,
        });
    }

    if (!isValidArticleTitle(title) || !isValidArticleContent(content)) {
        res.status(422);
        return res.render("board/new", {
            boardSlug: board.slug,
            boardDisplayName: board.name,
            formError: "Title or content is invalid.",
            title,
            content,
        });
    }

    // 4) 업로드 파일은 (DB 저장 전에) 먼저 파일 시스템에 저장합니다.
    //    업로드 중 실패하면 이미 저장된 파일도 롤백 정리합니다.
    let uploads;
    try {
        uploads = await storeArticleUploads(req);
    } catch (err) {
        res.status(422);
        return res.render("board/new", {
            boardSlug: board.slug,
            boardDisplayName: board.name,
            formError: err instanceof Error ? err.message : "Invalid upload.",
            title,
            content,
        });
    }

    // 5) DB 저장이 실패하면, 앞서 저장한 파일도 함께 정리합니다(누수 방지).
    let created;
    try {
        created = await createBoardArticle({
            boardId: board.boardId,
            userId: viewerContext.viewerUserId,
            title,
            content,
            imageUrl: uploads.imageUrl,
            fileUrl: uploads.fileUrl,
        });
    } catch (err) {
        await cleanupArticleUploads(uploads);
        throw err;
    }

    return res.redirect(`/board/${board.slug}/${created.displayId}`);
}

/**
 * 게시글 수정 폼(`/board/:slug/:displayId/edit`)을 렌더링합니다.
 * 보드 쓰기 정책 + 작성자/관리자 여부에 따라 403을 반환할 수 있습니다.
 */
export async function getArticleEditForm(req: Request, res: Response) {
    // 1) 라우트 파라미터를 정규화하고 수정 대상을 조회합니다.
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");
    const post = await requirePostBySlugDisplayId({ slug, displayId });

    // 2) 보드 쓰기 정책에 따라 작성자/관리자만 수정 폼 접근을 허용합니다.
    const policy = getBoardWritePolicy(slug);
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!canEditArticle(policy, viewerContext, post.userId)) {
        throw new HttpError(403, "Forbidden");
    }

    // 3) 저장된 파일 경로를 뷰에서 사용할 URL/파일명 형태로 변환합니다.
    const imageUrl = buildMediaUrl(post.imageUrl, ARTICLE_IMAGE_PUBLIC_BASE_PATH);
    const fileUrl = buildMediaUrl(post.fileUrl, ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH);
    const imageName = post.imageUrl ? path.basename(post.imageUrl) : null;

    // 4) 기존 글/첨부 상태를 채운 편집 폼을 렌더링합니다.
    return res.render("board/edit", {
        boardSlug: post.boardSlug,
        boardDisplayName: post.boardName,
        displayId: post.displayId,
        title: post.title,
        content: post.content,
        imageUrl,
        imageName,
        fileUrl,
        fileName: post.fileUrl ? path.basename(post.fileUrl) : null,
        formError: null,
    });
}

/**
 * 게시글 수정 요청(`/board/:slug/:displayId/edit`)을 처리합니다.
 *
 * 처리:
 * - 보드 쓰기 정책 + 작성자/관리자 권한 체크
 * - title/content 검증
 * - (옵션) 새 이미지/첨부 업로드 저장
 * - 게시글 업데이트(DB) 및 이전 파일 정리(best-effort)
 */
export async function postArticleEdit(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");
    const post = await requirePostBySlugDisplayId({ slug, displayId });

    // 1) 보드 쓰기 정책 + 작성자/관리자 권한을 확인합니다.
    const policy = getBoardWritePolicy(slug);
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!canEditArticle(policy, viewerContext, post.userId)) {
        throw new HttpError(403, "Forbidden");
    }

    // 2) 입력값 정규화/검증 (검증 실패 시 "현재 업로드 상태"를 유지한 채로 폼을 재표시).
    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();

    const currentImageUrl = buildMediaUrl(post.imageUrl, ARTICLE_IMAGE_PUBLIC_BASE_PATH);
    const currentFileUrl = buildMediaUrl(post.fileUrl, ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH);
    const currentImageName = post.imageUrl ? path.basename(post.imageUrl) : null;
    const currentFileName = post.fileUrl ? path.basename(post.fileUrl) : null;

    if (!title || !content) {
        res.status(400);
        return res.render("board/edit", {
            boardSlug: post.boardSlug,
            boardDisplayName: post.boardName,
            displayId: post.displayId,
            title,
            content,
            imageUrl: currentImageUrl,
            imageName: currentImageName,
            fileUrl: currentFileUrl,
            fileName: currentFileName,
            formError: "Title and content are required.",
        });
    }

    if (!isValidArticleTitle(title) || !isValidArticleContent(content)) {
        res.status(422);
        return res.render("board/edit", {
            boardSlug: post.boardSlug,
            boardDisplayName: post.boardName,
            displayId: post.displayId,
            title,
            content,
            imageUrl: currentImageUrl,
            imageName: currentImageName,
            fileUrl: currentFileUrl,
            fileName: currentFileName,
            formError: "Title or content is invalid.",
        });
    }

    // 3) 새 파일 업로드가 있는 경우에만 저장합니다.
    //    저장 중 실패하면 새로 저장된 파일만 정리하고, 기존 파일은 건드리지 않습니다.
    let uploads;
    try {
        uploads = await storeArticleUploads(req);
    } catch (err) {
        res.status(422);
        return res.render("board/edit", {
            boardSlug: post.boardSlug,
            boardDisplayName: post.boardName,
            displayId: post.displayId,
            title,
            content,
            imageUrl: currentImageUrl,
            imageName: currentImageName,
            fileUrl: currentFileUrl,
            fileName: currentFileName,
            formError: err instanceof Error ? err.message : "Invalid upload.",
        });
    }

    // 4) DB에는 "새 파일이 있으면 새 파일" 우선으로 반영합니다.
    const imageUrl = uploads.imageUrl ?? post.imageUrl ?? null;
    const fileUrl = uploads.fileUrl ?? post.fileUrl ?? null;

    const updated = await updateBoardArticle({
        postId: post.postId,
        title,
        content,
        imageUrl,
        fileUrl,
    });

    if (!updated) {
        // 업데이트 실패 시 새로 업로드한 파일만 정리합니다.
        await cleanupArticleUploads(uploads);
        throw new HttpError(404, "Not Found");
    }

    // 5) 새 파일로 교체된 경우, 기존 파일은 best-effort로 정리합니다.
    if (uploads.imageUrl && post.imageUrl) {
        await deleteStoredArticleImage(post.imageUrl);
    }

    if (uploads.fileUrl && post.fileUrl) {
        await deleteStoredArticleAttachment(post.fileUrl);
    }

    return res.redirect(`/board/${post.boardSlug}/${post.displayId}`);
}

/**
 * 게시글 삭제 요청을 처리합니다.
 *
 * - POST: 삭제 후 보드 목록으로 redirect + 플래시 메시지
 * - DELETE: 성공 시 204 응답
 *
 * 주의:
 * - 삭제는 세션 기반 인증이 필요합니다.
 */
export async function deleteArticle(req: Request, res: Response) {
    // 1) 삭제 대상 식별자를 정규화합니다.
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");

    // 2) 삭제는 세션 기반 인증이 전제입니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!viewerContext.isAuthenticated) {
        throw new HttpError(401, "Unauthorized");
    }

    // 3) 보드 삭제 정책(admin-only vs owner/admin)을 적용해 soft delete를 시도합니다.
    const policy = getBoardWritePolicy(slug);
    let deleted = false;

    if (policy.delete === "admin") {
        if (!viewerContext.isAdmin) {
            throw new HttpError(403, "Forbidden");
        }
        deleted = await softDeleteArticleBySlugDisplayIdAsAdmin({ slug, displayId });
    } else {
        deleted = await softDeleteArticleBySlugDisplayId({
            slug,
            displayId,
            requestUserId: viewerContext.viewerUserId,
        });
    }

    if (deleted) {
        // 4) 성공 시 요청 방식에 맞는 응답 형태를 분기합니다.
        //    HTML 폼(POST)은 redirect+flash, API/JS(DELETE)는 204를 반환합니다.
        if (req.method === "POST") {
            req.session.boardFlashMessage = "Article has been deleted.";
            return res.redirect(`/board/${encodeURIComponent(slug)}`);
        }
        return res.status(204).send();
    }

    // 5) 실패 시 "대상 없음(404)"과 "권한 없음(403)"을 구분해 응답합니다.
    const exists = await doesArticleExistBySlugDisplayId({ slug, displayId });
    if (!exists) {
        throw new HttpError(404, "Not Found");
    }

    throw new HttpError(403, "Forbidden");
}

/**
 * 게시글 상세(`/board/:slug/:displayId`)를 렌더링합니다.
 *
 * 처리:
 * - 보드 readAccess 체크
 * - owner_or_admin 보드의 경우 작성자/관리자만 접근 허용
 * - 이전/다음 게시글(neighbor) 링크 조회
 */
export async function getArticleShow(req: Request, res: Response) {
    // 1) 라우트 파라미터를 정규화하고 대상 보드 존재를 확인합니다.
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");

    const board = await requireBoardBySlug(slug);

    // 2) 보드 단위 readAccess 정책을 평가합니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const readAccessResult = getBoardReadAccessResult(board, viewerContext);
    if (readAccessResult === "unauthorized") {
        throw new HttpError(401, "Unauthorized");
    }
    if (readAccessResult === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }

    // 3) 상세 조회는 게시글이 존재하는지 먼저 확인합니다.
    const { viewerUserId, isAdmin } = viewerContext;
    const post = await findBoardArticleForShowBySlugDisplayId({ slug, displayId });
    if (!post) {
        throw new HttpError(404, "Not Found");
    }

    // 4) owner_or_admin 보드의 경우 게시글 단위로 작성자/관리자만 접근 가능합니다.
    const canRead = canReadArticleForBoard(board.readAccess, viewerContext, post.user_id);
    if (!canRead) {
        throw new HttpError(403, "Forbidden");
    }

    // 5) 글쓰기 정책에 따라 "수정/삭제" UI 노출 여부를 계산합니다.
    const writePolicy = getBoardWritePolicy(slug);
    const canEdit = canEditArticle(writePolicy, viewerContext, post.user_id);
    const canDelete = canDeleteArticle(writePolicy, viewerContext, post.user_id);

    // 6) 이전/다음 글 링크는 readAccess 정책에 따라 조회 범위를 제한합니다.
    //    owner_or_admin 보드에서 관리자가 아닌 경우, 본인 글만 이웃 글로 탐색합니다.
    const neighborParams: { boardId: number; displayId: number; viewerUserId?: number } = {
        boardId: post.board_id,
        displayId,
    };
    if (board.readAccess === "owner_or_admin" && !isAdmin) {
        neighborParams.viewerUserId = viewerUserId;
    }
    const { prevPost, nextPost } = await findNeighborArticles(neighborParams);

    return res.render("board/show", {
        post,
        prevPost,
        nextPost,
        boardSlug: slug,
        canEdit,
        canDelete,
    });
}
