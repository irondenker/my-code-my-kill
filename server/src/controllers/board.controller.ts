import type { Request, Response, NextFunction } from "express";
import path from "node:path";
import { HttpError } from "../utils/http-error.js";
import {
    buildViewerContext,
    canDeletePost,
    canEditPost,
    canReadPostForBoard,
    getBoardCreateAccessResult,
    getBoardReadAccessResult,
    getBoardWritePolicy,
    isValidPostContent,
    isValidPostTitle,
} from "../utils/board.policy.util.js";
import { buildPostFileUrl, buildPostImageUrl } from "../utils/post-media-url.util.js";
import {
    createBoardPost,
    doesPostExistBySlugDisplayId,
    findBoardBySlug,
    findBoardPostForShowBySlugDisplayId,
    findNeighborPosts,
    findPostBySlugDisplayId,
    deleteStoredPostAttachment,
    deleteStoredPostImage,
    softDeletePostBySlugDisplayId,
    softDeletePostBySlugDisplayIdAsAdmin,
    storePostAttachment,
    storePostImage,
    updateBoardPost,
} from "../services/board.service.js";
import { buildBoardIndexViewModel, buildBoardSlugViewModel } from "../view-models/board.view-model.js";

/**
 * 게시글 컨트롤러입니다.
 *
 * 원칙:
 * - 컨트롤러는 HTTP 흐름(req/res/session/redirect/render)만 담당합니다.
 * - 순수 판정/정규화는 `utils`로, DB/파일 I/O는 `services`로 위임합니다.
 */

/**
 * `multer.fields()`로 업로드된 파일 중, 특정 fieldName의 첫 번째 파일을 반환합니다.
 * 파일이 없으면 null을 반환합니다.
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

/**
 * 현재 요청에서 사용할 CSRF 토큰을 반환합니다.
 * CSRF 미들웨어가 적용되지 않은 라우트이거나 토큰 생성 함수가 없으면 null을 반환합니다.
 */
function getCsrfToken(req: Request): string | null {
    return typeof req.csrfToken === "function" ? req.csrfToken() : null;
}

/**
 * 라우트 파라미터의 slug를 정규화하고, 없으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
function getSlugParamOrThrow(req: Request): string {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
        throw new HttpError(404, "Not Found");
    }
    return slug;
}

/**
 * 라우트 파라미터의 displayId를 숫자로 파싱하고, 유효하지 않으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
function getDisplayIdParamOrThrow(req: Request): number {
    const displayId = Number(req.params.displayId);
    if (!Number.isFinite(displayId) || displayId <= 0) {
        throw new HttpError(404, "Not Found");
    }
    return displayId;
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
    const post = await findPostBySlugDisplayId(params);
    if (!post) {
        throw new HttpError(404, "Not Found");
    }
    return post;
}

/**
 * 게시글 작성 폼을 렌더링합니다.
 * 오류가 있는 경우 title/content를 함께 바인딩하여 재표시합니다.
 */
function renderBoardCreate(
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
function renderBoardEdit(
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

/**
 * 전체 보드 목록(`/board`)을 렌더링합니다.
 */
export async function getBoardIndex(req: Request, res: Response, next: NextFunction) {
    try {
        const viewModel = await buildBoardIndexViewModel(req);
        return res.render('board/index', viewModel);
    } catch (err) {
        return next(err);
    }
}

/**
 * 특정 보드의 글 목록(`/board/:slug`)을 렌더링합니다.
 * 보드 readAccess 정책에 따라 401/403을 반환할 수 있습니다.
 */
export async function getBoardBySlug(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = getSlugParamOrThrow(req);
        const board = await requireBoardBySlug(slug);

        const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
        const readAccessResult = getBoardReadAccessResult(board, viewerContext);
        if (readAccessResult === "unauthorized") {
            return next(new HttpError(401, "Unauthorized"));
        }
        if (readAccessResult === "forbidden") {
            return next(new HttpError(403, "Forbidden"));
        }

        const viewModel = await buildBoardSlugViewModel(req, slug);
        return res.render("board/index", viewModel);
    } catch (err) {
        return next(err);
    }
}

/**
 * 게시글 작성 폼(`/board/:slug/new`)을 렌더링합니다.
 * 보드 createAccess 정책에 따라 401 redirect 또는 403을 반환할 수 있습니다.
 */
export async function getBoardCreateForm(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = getSlugParamOrThrow(req);
        const board = await requireBoardBySlug(slug);

        const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
        const createAccess = getBoardCreateAccessResult(board, viewerContext);
        if (createAccess === "forbidden") {
            return next(new HttpError(403, "Forbidden"));
        }
        if (createAccess === "redirect_login") {
            return res.status(401).redirect("/login");
        }

        return res.render("board/new", { boardSlug: board.slug, boardDisplayName: board.name, formError: null });
    } catch (err) {
        return next(err);
    }
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
export async function postBoardCreate(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = getSlugParamOrThrow(req);
        const board = await requireBoardBySlug(slug);

        const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
        const createAccess = getBoardCreateAccessResult(board, viewerContext);
        if (createAccess === "forbidden") {
            return next(new HttpError(403, "Forbidden"));
        }
        if (createAccess === "redirect_login") {
            return res.status(401).redirect("/login");
        }

        if (!Number.isFinite(viewerContext.viewerUserId) || viewerContext.viewerUserId <= 0) {
            return next(new HttpError(401, "Unauthorized"));
        }

        const title = String(req.body?.title ?? "").trim();
        const content = String(req.body?.content ?? "").trim();

        if (!title || !content) {
            res.status(400);
            return renderBoardCreate(req, res, {
                boardSlug: board.slug,
                boardDisplayName: board.name,
                formError: "Title and content are required.",
                title,
                content,
            });
        }

        if (!isValidPostTitle(title) || !isValidPostContent(content)) {
            res.status(422);
            return renderBoardCreate(req, res, {
                boardSlug: board.slug,
                boardDisplayName: board.name,
                formError: "Title or content is invalid.",
                title,
                content,
            });
        }

        const imageFile = getUploadedFile(req, "image");
        const attachmentFile = getUploadedFile(req, "attachment");
        let savedImage: string | null = null;
        let savedAttachment: string | null = null;

        try {
            if (imageFile) {
                savedImage = await storePostImage(imageFile);
            }
            if (attachmentFile) {
                savedAttachment = await storePostAttachment(attachmentFile);
            }
        } catch (err) {
            await deleteStoredPostImage(savedImage);
            await deleteStoredPostAttachment(savedAttachment);
            res.status(422);
            return renderBoardCreate(req, res, {
                boardSlug: board.slug,
                boardDisplayName: board.name,
                formError: err instanceof Error ? err.message : "Invalid upload.",
                title,
                content,
            });
        }

        let created;
        try {
            created = await createBoardPost({
                boardId: board.boardId,
                userId: viewerContext.viewerUserId,
                title,
                content,
                imageUrl: savedImage,
                fileUrl: savedAttachment,
            });
        } catch (err) {
            await deleteStoredPostImage(savedImage);
            await deleteStoredPostAttachment(savedAttachment);
            throw err;
        }

        return res.redirect(`/board/${board.slug}/${created.displayId}`);
    } catch (err) {
        return next(err);
    }
}

/**
 * 게시글 수정 폼(`/board/:slug/:displayId/edit`)을 렌더링합니다.
 * 보드 쓰기 정책 + 작성자/관리자 여부에 따라 403을 반환할 수 있습니다.
 */
export async function getBoardEditForm(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = getSlugParamOrThrow(req);
        const displayId = getDisplayIdParamOrThrow(req);
        const post = await requirePostBySlugDisplayId({ slug, displayId });

        const policy = getBoardWritePolicy(slug);
        const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
        if (!canEditPost(policy, viewerContext, post.userId)) {
            return next(new HttpError(403, "Forbidden"));
        }

        const imageUrl = buildPostImageUrl(post.imageUrl);
        const fileUrl = buildPostFileUrl(post.fileUrl);
        const imageName = post.imageUrl ? path.basename(post.imageUrl) : null;

        return renderBoardEdit(req, res, {
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
    } catch (err) {
        return next(err);
    }
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
export async function postBoardEdit(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = getSlugParamOrThrow(req);
        const displayId = getDisplayIdParamOrThrow(req);
        const post = await requirePostBySlugDisplayId({ slug, displayId });

        const policy = getBoardWritePolicy(slug);
        const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
        if (!canEditPost(policy, viewerContext, post.userId)) {
            return next(new HttpError(403, "Forbidden"));
        }

        const title = String(req.body?.title ?? "").trim();
        const content = String(req.body?.content ?? "").trim();

        const currentImageUrl = buildPostImageUrl(post.imageUrl);
        const currentFileUrl = buildPostFileUrl(post.fileUrl);
        const currentImageName = post.imageUrl ? path.basename(post.imageUrl) : null;
        const currentFileName = post.fileUrl ? path.basename(post.fileUrl) : null;

        if (!title || !content) {
            res.status(400);
            return renderBoardEdit(req, res, {
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

        if (!isValidPostTitle(title) || !isValidPostContent(content)) {
            res.status(422);
            return renderBoardEdit(req, res, {
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

        const imageFile = getUploadedFile(req, "image");
        const attachmentFile = getUploadedFile(req, "attachment");
        let newImage: string | null = null;
        let newAttachment: string | null = null;

        try {
            if (imageFile) {
                newImage = await storePostImage(imageFile);
            }
            if (attachmentFile) {
                newAttachment = await storePostAttachment(attachmentFile);
            }
        } catch (err) {
            await deleteStoredPostImage(newImage);
            await deleteStoredPostAttachment(newAttachment);
            res.status(422);
            return renderBoardEdit(req, res, {
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

        const imageUrl = newImage ?? post.imageUrl ?? null;
        const fileUrl = newAttachment ?? post.fileUrl ?? null;

        const updated = await updateBoardPost({
            postId: post.postId,
            title,
            content,
            imageUrl,
            fileUrl,
        });

        if (!updated) {
            await deleteStoredPostImage(newImage);
            await deleteStoredPostAttachment(newAttachment);
            return next(new HttpError(404, "Not Found"));
        }

        if (newImage && post.imageUrl) {
            await deleteStoredPostImage(post.imageUrl);
        }

        if (newAttachment && post.fileUrl) {
            await deleteStoredPostAttachment(post.fileUrl);
        }

        return res.redirect(`/board/${post.boardSlug}/${post.displayId}`);
    } catch (err) {
        return next(err);
    }
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
export async function deleteBoardPost(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = getSlugParamOrThrow(req);
        const displayId = getDisplayIdParamOrThrow(req);
        const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
        if (!viewerContext.isAuthenticated) {
            return next(new HttpError(401, "Unauthorized"));
        }

        const policy = getBoardWritePolicy(slug);
        let deleted = false;

        if (policy.delete === "admin") {
            if (!viewerContext.isAdmin) {
                return next(new HttpError(403, "Forbidden"));
            }
            deleted = await softDeletePostBySlugDisplayIdAsAdmin({ slug, displayId });
        } else {
            deleted = await softDeletePostBySlugDisplayId({
                slug,
                displayId,
                requestUserId: viewerContext.viewerUserId,
            });
        }

        if (deleted) {
            if (req.method === "POST") {
                req.session.boardFlashMessage = "Post has been deleted.";
                return res.redirect(`/board/${encodeURIComponent(slug)}`);
            }
            return res.status(204).send();
        }

        const exists = await doesPostExistBySlugDisplayId({ slug, displayId });
        if (!exists) {
            return next(new HttpError(404, "Not Found"));
        }

        return next(new HttpError(403, "Forbidden"));
    } catch (err) {
        return next(err);
    }
}

/**
 * 게시글 상세(`/board/:slug/:displayId`)를 렌더링합니다.
 *
 * 처리:
 * - 보드 readAccess 체크
 * - owner_or_admin 보드의 경우 작성자/관리자만 접근 허용
 * - 이전/다음 게시글(neighbor) 링크 조회
 */
export async function getBoardShow(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = getSlugParamOrThrow(req);
        const displayId = getDisplayIdParamOrThrow(req);

        const board = await requireBoardBySlug(slug);

        const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
        const readAccessResult = getBoardReadAccessResult(board, viewerContext);
        if (readAccessResult === "unauthorized") {
            return next(new HttpError(401, "Unauthorized"));
        }
        if (readAccessResult === "forbidden") {
            return next(new HttpError(403, "Forbidden"));
        }

        const { viewerUserId, isAdmin } = viewerContext;
        const post = await findBoardPostForShowBySlugDisplayId({ slug, displayId });
        if (!post) {
            return next(new HttpError(404, "Not Found"));
        }

        const canReadPost = canReadPostForBoard(board.readAccess, viewerContext, post.user_id);
        if (!canReadPost) {
            return next(new HttpError(403, "Forbidden"));
        }

        const writePolicy = getBoardWritePolicy(slug);
        const canEdit = canEditPost(writePolicy, viewerContext, post.user_id);
        const canDelete = canDeletePost(writePolicy, viewerContext, post.user_id);
        const neighborParams: { boardId: number; displayId: number; viewerUserId?: number } = {
            boardId: post.board_id,
            displayId,
        };
        if (board.readAccess === "owner_or_admin" && !isAdmin) {
            neighborParams.viewerUserId = viewerUserId;
        }
        const { prevPost, nextPost } = await findNeighborPosts(neighborParams);

        return res.render("board/show", {
            post,
            prevPost,
            nextPost,
            boardSlug: slug,
            canEdit,
            canDelete,
        });
    } catch (err) {
        next(err);
    }
}
