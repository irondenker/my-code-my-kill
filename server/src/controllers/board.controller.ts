import type { Request, Response } from "express";
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
} from "../utils/board.policy.util.js";
import { isValidPostContent, isValidPostTitle } from "../utils/post-validation.util.js";
import { buildPostMediaUrl } from "../utils/post-media-url.util.js";
import { POST_ATTACHMENT_PUBLIC_BASE_PATH, POST_IMAGE_PUBLIC_BASE_PATH } from "../constants/post-upload.constants.js";
import {
    createBoardPost,
    doesPostExistBySlugDisplayId,
    findBoardBySlug,
    findBoardPostForShowBySlugDisplayId,
    findNeighborPosts,
    findPostBySlugDisplayId,
    countBoardPostsBySlug,
    listBoardPostOutlinesBySlug,
    listBoards,
    deleteStoredPostAttachment,
    deleteStoredPostImage,
    storePostAttachment,
    storePostImage,
    softDeletePostBySlugDisplayId,
    softDeletePostBySlugDisplayIdAsAdmin,
    updateBoardPost,
} from "../services/board.service.js";
import { createPaginationMeta } from "../utils/board.util.js";
import { PAGINATION_DEFAULT_LIMIT } from "../constants/board.constants.js";

/**
 * 게시글 컨트롤러입니다.
 *
 * 원칙:
 * - 컨트롤러는 HTTP 흐름(req/res/session/redirect/render)만 담당합니다.
 * - 순수 판정/정규화는 `utils`로, DB/파일 I/O는 `services`로 위임합니다.
 */

/**
 * 양의 정수를 파싱합니다.
 * 숫자가 아니거나 1 미만이면 fallback을 반환합니다.
 */
function parsePositiveInt(rawValue: unknown, fallback: number): number {
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/**
 * 라우트 파라미터를 문자열로 정규화(trim)하여 반환합니다.
 * 값이 비어 있으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
function getStringParamOrThrow(req: Request, paramName: string): string {
    const value = String((req.params as Record<string, unknown>)[paramName] ?? "").trim();
    if (!value) {
        throw new HttpError(404, "Not Found");
    }
    return value;
}

/**
 * 라우트 파라미터를 양의 정수로 파싱하여 반환합니다.
 * 유효하지 않으면 404를 던집니다.
 *
 * @throws HttpError(404)
 */
function getPositiveIntParamOrThrow(req: Request, paramName: string): number {
    const raw = (req.params as Record<string, unknown>)[paramName];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        throw new HttpError(404, "Not Found");
    }
    return Math.trunc(value);
}

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
async function storeBoardPostUploads(req: Request): Promise<StoredUploads> {
    const imageFile = getUploadedFile(req, "image");
    const attachmentFile = getUploadedFile(req, "attachment");
    let imageUrl: string | null = null;
    let fileUrl: string | null = null;

    try {
        if (imageFile) {
            imageUrl = await storePostImage(imageFile);
        }
        if (attachmentFile) {
            fileUrl = await storePostAttachment(attachmentFile);
        }
        return { imageUrl, fileUrl };
    } catch (err) {
        await cleanupBoardPostUploads({ imageUrl, fileUrl });
        throw err;
    }
}

/**
 * 저장된 업로드 파일을 best-effort로 정리합니다.
 * (파일이 null이거나 이미 삭제된 경우도 안전해야 합니다.)
 */
async function cleanupBoardPostUploads(uploads: StoredUploads): Promise<void> {
    await Promise.all([deleteStoredPostImage(uploads.imageUrl), deleteStoredPostAttachment(uploads.fileUrl)]);
}

/**
 * 보드 목록 화면에서 사용하는 플래시 메시지를 소비합니다.
 * 한 번 읽으면 세션에서 삭제합니다.
 */
function consumeBoardFlashMessage(req: Request): string | null {
    const value = req.session.boardFlashMessage;
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }
    delete req.session.boardFlashMessage;
    return value;
}

/**
 * 보드 디렉토리(목록) 접근 여부를 판정합니다.
 * readAccess 정책 중 `owner_or_admin`은 "게시글 단위" 정책이라 목록 접근엔 적용하지 않습니다.
 */
function canAccessBoardDirectory(req: Request, board: NonNullable<Awaited<ReturnType<typeof findBoardBySlug>>>): boolean {
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);

    if (board.readAccess === "public") {
        return true;
    }
    if (board.readAccess === "admin") {
        return viewerContext.isAdmin;
    }
    return viewerContext.isAuthenticated;
}

/**
 * 보드 목록/게시글 목록 화면에서 "글쓰기" 버튼 노출 여부를 판정합니다.
 */
function canCreateForBoard(req: Request, board: Awaited<ReturnType<typeof findBoardBySlug>>): boolean {
    if (!board) {
        return false;
    }

    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!viewerContext.isAuthenticated) {
        return false;
    }

    return board.createAccess === "admin" ? viewerContext.isAdmin : true;
}

/**
 * owner_or_admin 보드에서 특정 게시글(작성자) 열람 가능 여부를 판정합니다.
 * 기타 readAccess는 컨트롤러에서 이미 처리되므로 여기서는 통과로 봅니다.
 */
function canReadPost(req: Request, board: Awaited<ReturnType<typeof findBoardBySlug>>, postUserId: number): boolean {
    if (!board) {
        return true;
    }

    if (board.readAccess !== "owner_or_admin") {
        return true;
    }

    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    return viewerContext.isAdmin || viewerContext.viewerUserId === postUserId;
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
 * 전체 보드 목록(`/board`)을 렌더링합니다.
 */
export async function getBoardIndex(req: Request, res: Response) {
    const boards = (await listBoards()).filter((board) => canAccessBoardDirectory(req, board));

    return res.render("board/index", {
        boardSlug: null,
        boardDisplayName: "Boards",
        boardDescription: null,
        formSuccess: null,
        canCreate: false,
        boards,
    });
}

/**
 * 특정 보드의 글 목록(`/board/:slug`)을 렌더링합니다.
 * 보드 readAccess 정책에 따라 401/403을 반환할 수 있습니다.
 */
export async function getBoardBySlug(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const board = await requireBoardBySlug(slug);

    // 1) 보드 단위 readAccess 정책을 먼저 평가합니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const readAccessResult = getBoardReadAccessResult(board, viewerContext);
    if (readAccessResult === "unauthorized") {
        throw new HttpError(401, "Unauthorized");
    }
    if (readAccessResult === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }

    // 2) 페이지네이션 파라미터를 정규화하고, 목록 상단에 노출할 플래시 메시지를 소비합니다.
    const page = parsePositiveInt(req.query.page, 1);
    const formSuccess = consumeBoardFlashMessage(req);

    // 3) 전체 개수 -> 페이지 메타 계산 -> 현재 페이지 오프셋 계산 순서로 목록을 조회합니다.
    const totalCount = await countBoardPostsBySlug(slug);
    const limit = PAGINATION_DEFAULT_LIMIT;

    const totalPages = createPaginationMeta(totalCount, limit);
    const offset = (page - 1) * limit;

    const outlines = await listBoardPostOutlinesBySlug({
        slug,
        offset,
        limit,
    });

    // 4) owner_or_admin 보드는 "게시글 단위"로 열람 가능 여부가 갈리므로,
    //    목록에서는 열람 불가 글의 제목을 마스킹하고 "열기 가능 여부" 플래그를 내려줍니다.
    const postOutlines = outlines.map((post) => {
        const canOpen = canReadPost(req, board, post.userId);
        return {
            ...post,
            title: canOpen ? post.title : "비밀글",
            canOpen,
        };
    });

    return res.render("board/index", {
        boardSlug: slug,
        boardDisplayName: board.name,
        boardDescription: board.description ?? null,
        formSuccess,
        canCreate: canCreateForBoard(req, board),
        postOutlines,
        pagination: {
            page,
            totalPages,
            totalCount,
            limit,
        },
    });
}

/**
 * 게시글 작성 폼(`/board/:slug/new`)을 렌더링합니다.
 * 보드 createAccess 정책에 따라 401 redirect 또는 403을 반환할 수 있습니다.
 */
export async function getBoardCreateForm(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const board = await requireBoardBySlug(slug);

    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const createAccess = getBoardCreateAccessResult(board, viewerContext);
    if (createAccess === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }
    if (createAccess === "redirect_login") {
        return res.status(401).redirect("/login");
    }

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
export async function postBoardCreate(req: Request, res: Response) {
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

    if (!isValidPostTitle(title) || !isValidPostContent(content)) {
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
        uploads = await storeBoardPostUploads(req);
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
        created = await createBoardPost({
            boardId: board.boardId,
            userId: viewerContext.viewerUserId,
            title,
            content,
            imageUrl: uploads.imageUrl,
            fileUrl: uploads.fileUrl,
        });
    } catch (err) {
        await cleanupBoardPostUploads(uploads);
        throw err;
    }

    return res.redirect(`/board/${board.slug}/${created.displayId}`);
}

/**
 * 게시글 수정 폼(`/board/:slug/:displayId/edit`)을 렌더링합니다.
 * 보드 쓰기 정책 + 작성자/관리자 여부에 따라 403을 반환할 수 있습니다.
 */
export async function getBoardEditForm(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");
    const post = await requirePostBySlugDisplayId({ slug, displayId });

    const policy = getBoardWritePolicy(slug);
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!canEditPost(policy, viewerContext, post.userId)) {
        throw new HttpError(403, "Forbidden");
    }

    const imageUrl = buildPostMediaUrl(post.imageUrl, POST_IMAGE_PUBLIC_BASE_PATH);
    const fileUrl = buildPostMediaUrl(post.fileUrl, POST_ATTACHMENT_PUBLIC_BASE_PATH);
    const imageName = post.imageUrl ? path.basename(post.imageUrl) : null;

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
export async function postBoardEdit(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");
    const post = await requirePostBySlugDisplayId({ slug, displayId });

    // 1) 보드 쓰기 정책 + 작성자/관리자 권한을 확인합니다.
    const policy = getBoardWritePolicy(slug);
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!canEditPost(policy, viewerContext, post.userId)) {
        throw new HttpError(403, "Forbidden");
    }

    // 2) 입력값 정규화/검증 (검증 실패 시 "현재 업로드 상태"를 유지한 채로 폼을 재표시).
    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();

    const currentImageUrl = buildPostMediaUrl(post.imageUrl, POST_IMAGE_PUBLIC_BASE_PATH);
    const currentFileUrl = buildPostMediaUrl(post.fileUrl, POST_ATTACHMENT_PUBLIC_BASE_PATH);
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

    if (!isValidPostTitle(title) || !isValidPostContent(content)) {
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
        uploads = await storeBoardPostUploads(req);
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

    const updated = await updateBoardPost({
        postId: post.postId,
        title,
        content,
        imageUrl,
        fileUrl,
    });

    if (!updated) {
        // 업데이트 실패 시 새로 업로드한 파일만 정리합니다.
        await cleanupBoardPostUploads(uploads);
        throw new HttpError(404, "Not Found");
    }

    // 5) 새 파일로 교체된 경우, 기존 파일은 best-effort로 정리합니다.
    if (uploads.imageUrl && post.imageUrl) {
        await deleteStoredPostImage(post.imageUrl);
    }

    if (uploads.fileUrl && post.fileUrl) {
        await deleteStoredPostAttachment(post.fileUrl);
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
export async function deleteBoardPost(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");

    // 삭제는 세션 기반 인증이 전제입니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    if (!viewerContext.isAuthenticated) {
        throw new HttpError(401, "Unauthorized");
    }

    // 보드 삭제 정책(admin-only vs owner/admin)을 적용합니다.
    const policy = getBoardWritePolicy(slug);
    let deleted = false;

    if (policy.delete === "admin") {
        if (!viewerContext.isAdmin) {
            throw new HttpError(403, "Forbidden");
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
        // HTML 폼은 보통 POST로 오므로 redirect + 플래시를 사용하고,
        // API/JS 호출은 DELETE로 오므로 204로 응답합니다.
        if (req.method === "POST") {
            req.session.boardFlashMessage = "Post has been deleted.";
            return res.redirect(`/board/${encodeURIComponent(slug)}`);
        }
        return res.status(204).send();
    }

    // 삭제 실패의 원인이 "대상 없음"인지 "권한 없음"인지 구분해 응답합니다.
    const exists = await doesPostExistBySlugDisplayId({ slug, displayId });
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
export async function getBoardShow(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");

    const board = await requireBoardBySlug(slug);

    // 1) 보드 단위 readAccess 정책을 평가합니다.
    const viewerContext = buildViewerContext(req.session.userId, req.session.userRole);
    const readAccessResult = getBoardReadAccessResult(board, viewerContext);
    if (readAccessResult === "unauthorized") {
        throw new HttpError(401, "Unauthorized");
    }
    if (readAccessResult === "forbidden") {
        throw new HttpError(403, "Forbidden");
    }

    // 2) 상세 조회는 게시글이 존재하는지 먼저 확인합니다.
    const { viewerUserId, isAdmin } = viewerContext;
    const post = await findBoardPostForShowBySlugDisplayId({ slug, displayId });
    if (!post) {
        throw new HttpError(404, "Not Found");
    }

    // 3) owner_or_admin 보드의 경우 게시글 단위로 작성자/관리자만 접근 가능합니다.
    const canRead = canReadPostForBoard(board.readAccess, viewerContext, post.user_id);
    if (!canRead) {
        throw new HttpError(403, "Forbidden");
    }

    // 4) 글쓰기 정책에 따라 "수정/삭제" UI 노출 여부를 계산합니다.
    const writePolicy = getBoardWritePolicy(slug);
    const canEdit = canEditPost(writePolicy, viewerContext, post.user_id);
    const canDelete = canDeletePost(writePolicy, viewerContext, post.user_id);

    // 5) 이전/다음 글 링크는 readAccess 정책에 따라 조회 범위를 제한합니다.
    //    owner_or_admin 보드에서 관리자가 아닌 경우, 본인 글만 이웃 글로 탐색합니다.
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
}
