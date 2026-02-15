import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { QueryTypes } from "sequelize";
import sharp from "sharp";
import { sequelize } from "../db/index.js";
import { HttpError } from "../utils/http-error.js";
import { ensureDir, safeUnlink } from "../utils/fs.util.js";
import {
    isExtensionCheckEnabled,
    isMagicNumberCheckEnabled,
    resolveAttachmentExpectation,
    validateAllowedExtension,
    validateMagicNumberForAttachment,
    validateMagicNumberForImage,
} from "../utils/upload-validation.util.js";
import {
    type BoardMeta,
    createBoardPost,
    doesPostExistBySlugDisplayId,
    findBoardBySlug,
    findPostBySlugDisplayId,
    softDeletePostBySlugDisplayId,
    softDeletePostBySlugDisplayIdAsAdmin,
    updateBoardPost,
} from "../services/board.service.js";
import { buildBoardIndexViewModel, buildBoardSlugViewModel } from "../view-models/board.view-model.js";

type BoardWritePolicy = {
    update: "self" | "admin";
    delete: "selfOrAdmin" | "admin";
};

type ViewerContext = {
    viewerUserId: number;
    isAuthenticated: boolean;
    isAdmin: boolean;
};

function getBoardWritePolicy(slug: string): BoardWritePolicy {
    if (slug === "announcement") {
        return {
            update: "admin",
            delete: "admin",
        };
    }

    return {
        update: "self",
        delete: "selfOrAdmin",
    };
}

function getViewerContext(req: Request): ViewerContext {
    const viewerUserId = Number(req.session.userId);
    const isAuthenticated = Number.isFinite(viewerUserId) && viewerUserId > 0;
    const isAdmin = req.session.userRole === "admin";
    return { viewerUserId, isAuthenticated, isAdmin };
}

function getBoardReadAccessResult(board: BoardMeta, context: ViewerContext): "ok" | "unauthorized" | "forbidden" {
    if (board.readAccess === "public") {
        return "ok";
    }

    if (board.readAccess === "admin") {
        if (!context.isAuthenticated) {
            return "unauthorized";
        }
        return context.isAdmin ? "ok" : "forbidden";
    }

    if (!context.isAuthenticated) {
        return "unauthorized";
    }

    return "ok";
}

function canReadPostForBoard(board: BoardMeta, context: ViewerContext, postUserId: number): boolean {
    if (board.readAccess !== "owner_or_admin") {
        return true;
    }
    return context.isAdmin || context.viewerUserId === postUserId;
}

function isValidTitle(title: string): boolean {
    return title.length >= 2 && title.length <= 255;
}

function isValidContent(content: string): boolean {
    return content.length >= 2 && content.length <= 10_000;
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FILE_MIME_TYPES = new Set([
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.ms-excel",
    "application/zip",
    "application/x-zip-compressed",
]);
const FILE_EXTENSIONS = new Set([".pdf", ".txt", ".csv", ".zip"]);

const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const FILE_MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 5120;
const IMAGE_QUALITY = 82;
const POST_IMAGE_MAX_WIDTH = 1280;
const IMAGE_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "posts", "images");
const FILE_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "posts", "files");

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

function buildPostImageUrl(value: string | null): string | null {
    if (!value) {
        return null;
    }
    return value.startsWith("/") ? value : `/uploads/posts/images/${value}`;
}

function buildPostFileUrl(value: string | null): string | null {
    if (!value) {
        return null;
    }
    return value.startsWith("/") ? value : `/uploads/posts/files/${value}`;
}

async function ensurePostUploadDirs() {
    await Promise.all([ensureDir(IMAGE_UPLOAD_DIR), ensureDir(FILE_UPLOAD_DIR)]);
}

function createUploadName(prefix: string, extension: string) {
    const suffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    return `${prefix}-${suffix}${extension}`;
}

async function storePostImage(file: Express.Multer.File): Promise<string> {
    if (isMagicNumberCheckEnabled()) {
        validateMagicNumberForImage(file.buffer);
    }
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
        throw new Error("Unsupported image type.");
    }
    if (file.size > IMAGE_MAX_BYTES) {
        throw new Error("Image file is too large.");
    }

    const image = sharp(file.buffer, {
        limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
    });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
        throw new Error("Invalid image data.");
    }
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        throw new Error("Image dimensions exceed the limit.");
    }

    await ensurePostUploadDirs();
    const filename = createUploadName("post-image", ".webp");
    const outputPath = path.join(IMAGE_UPLOAD_DIR, filename);

    await image
        .resize(POST_IMAGE_MAX_WIDTH, POST_IMAGE_MAX_WIDTH, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: IMAGE_QUALITY })
        .toFile(outputPath);

    return filename;
}

async function storePostAttachment(file: Express.Multer.File): Promise<string> {
    if (!FILE_MIME_TYPES.has(file.mimetype)) {
        throw new Error("Unsupported attachment type.");
    }
    if (file.size > FILE_MAX_BYTES) {
        throw new Error("Attachment file is too large.");
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (isExtensionCheckEnabled()) {
        validateAllowedExtension(file.originalname, FILE_EXTENSIONS);
    }
    if (isMagicNumberCheckEnabled()) {
        const expectation = resolveAttachmentExpectation({
            extension,
            mimetype: file.mimetype,
            trustExtension: isExtensionCheckEnabled(),
        });
        if (!expectation) {
            throw new Error("Unsupported attachment type.");
        }
        validateMagicNumberForAttachment(file.buffer, expectation);
    }

    await ensurePostUploadDirs();
    const filename = createUploadName("post-file", extension);
    const outputPath = path.join(FILE_UPLOAD_DIR, filename);
    await fs.writeFile(outputPath, file.buffer);

    return filename;
}

async function removeFile(filePath: string | null) {
    await safeUnlink(filePath);
}

export async function getBoardIndex(req: Request, res: Response, next: NextFunction) {
    try {
        const viewModel = await buildBoardIndexViewModel(req);
        return res.render('board/index', viewModel);
    } catch (err) {
        return next(err);
    }
}

export async function getBoardBySlug(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        if (!slug) {
            return next(new HttpError(404, "Not Found"));
        }

        const board = await findBoardBySlug(slug);
        if (!board) {
            return next(new HttpError(404, "Not Found"));
        }

        const viewerContext = getViewerContext(req);
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

export async function getBoardCreateForm(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        if (!slug) {
            return next(new HttpError(404, "Not Found"));
        }

        const board = await findBoardBySlug(slug);
        if (!board) {
            return next(new HttpError(404, "Not Found"));
        }

        const policy = board;
        const { isAuthenticated, isAdmin } = getViewerContext(req);

        if (policy.createAccess === "admin" && !isAdmin) {
            return next(new HttpError(403, "Forbidden"));
        }

        if (policy.createAccess === "auth" && !isAuthenticated) {
            return res.status(401).redirect("/login");
        }

        return res.render("board/new", {
            boardSlug: board.slug,
            boardDisplayName: board.name,
            formError: null,
        });
    } catch (err) {
        return next(err);
    }
}

export async function postBoardCreate(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        if (!slug) {
            return next(new HttpError(404, "Not Found"));
        }

        const board = await findBoardBySlug(slug);
        if (!board) {
            return next(new HttpError(404, "Not Found"));
        }

        const policy = board;
        const { viewerUserId, isAuthenticated, isAdmin } = getViewerContext(req);

        if (policy.createAccess === "admin" && !isAdmin) {
            return next(new HttpError(403, "Forbidden"));
        }

        if (policy.createAccess === "auth" && !isAuthenticated) {
            return res.status(401).redirect("/login");
        }

        if (!Number.isFinite(viewerUserId) || viewerUserId <= 0) {
            return next(new HttpError(401, "Unauthorized"));
        }

        const title = String(req.body?.title ?? "").trim();
        const content = String(req.body?.content ?? "").trim();

        if (!title || !content) {
            return res.status(400).render("board/new", {
                boardSlug: board.slug,
                boardDisplayName: board.name,
                formError: "Title and content are required.",
                title,
                content,
                csrfToken: typeof req.csrfToken === "function" ? req.csrfToken() : null,
            });
        }

        if (!isValidTitle(title) || !isValidContent(content)) {
            return res.status(422).render("board/new", {
                boardSlug: board.slug,
                boardDisplayName: board.name,
                formError: "Title or content is invalid.",
                title,
                content,
                csrfToken: typeof req.csrfToken === "function" ? req.csrfToken() : null,
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
            await removeFile(savedImage ? path.join(IMAGE_UPLOAD_DIR, savedImage) : null);
            await removeFile(savedAttachment ? path.join(FILE_UPLOAD_DIR, savedAttachment) : null);
            return res.status(422).render("board/new", {
                boardSlug: board.slug,
                boardDisplayName: board.name,
                formError: err instanceof Error ? err.message : "Invalid upload.",
                title,
                content,
                csrfToken: typeof req.csrfToken === "function" ? req.csrfToken() : null,
            });
        }

        let created;
        try {
            created = await createBoardPost({
                boardId: board.boardId,
                userId: viewerUserId,
                title,
                content,
                imageUrl: savedImage,
                fileUrl: savedAttachment,
            });
        } catch (err) {
            await removeFile(savedImage ? path.join(IMAGE_UPLOAD_DIR, savedImage) : null);
            await removeFile(savedAttachment ? path.join(FILE_UPLOAD_DIR, savedAttachment) : null);
            throw err;
        }

        return res.redirect(`/board/${board.slug}/${created.displayId}`);
    } catch (err) {
        return next(err);
    }
}

export async function getBoardEditForm(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        const displayId = Number(req.params.displayId);
        if (!slug) {
            return next(new HttpError(404, "Not Found"));
        }
        if (!Number.isFinite(displayId) || displayId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const post = await findPostBySlugDisplayId({ slug, displayId });
        if (!post) {
            return next(new HttpError(404, "Not Found"));
        }

        const policy = getBoardWritePolicy(slug);
        const { viewerUserId, isAdmin } = getViewerContext(req);
        const isOwner = viewerUserId === post.userId;

        const canEdit = policy.update === "admin" ? isAdmin : isOwner;
        if (!canEdit) {
            return next(new HttpError(403, "Forbidden"));
        }

        const imageUrl = buildPostImageUrl(post.imageUrl);
        const fileUrl = buildPostFileUrl(post.fileUrl);
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
    } catch (err) {
        return next(err);
    }
}

export async function postBoardEdit(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        const displayId = Number(req.params.displayId);
        if (!slug) {
            return next(new HttpError(404, "Not Found"));
        }
        if (!Number.isFinite(displayId) || displayId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const post = await findPostBySlugDisplayId({ slug, displayId });
        if (!post) {
            return next(new HttpError(404, "Not Found"));
        }

        const policy = getBoardWritePolicy(slug);
        const { viewerUserId, isAdmin } = getViewerContext(req);
        const isOwner = viewerUserId === post.userId;

        const canEdit = policy.update === "admin" ? isAdmin : isOwner;
        if (!canEdit) {
            return next(new HttpError(403, "Forbidden"));
        }

        const title = String(req.body?.title ?? "").trim();
        const content = String(req.body?.content ?? "").trim();

        const currentImageUrl = buildPostImageUrl(post.imageUrl);
        const currentFileUrl = buildPostFileUrl(post.fileUrl);
        const currentImageName = post.imageUrl ? path.basename(post.imageUrl) : null;
        const currentFileName = post.fileUrl ? path.basename(post.fileUrl) : null;

        if (!title || !content) {
            return res.status(400).render("board/edit", {
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
                csrfToken: typeof req.csrfToken === "function" ? req.csrfToken() : null,
            });
        }

        if (!isValidTitle(title) || !isValidContent(content)) {
            return res.status(422).render("board/edit", {
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
                csrfToken: typeof req.csrfToken === "function" ? req.csrfToken() : null,
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
            await removeFile(newImage ? path.join(IMAGE_UPLOAD_DIR, newImage) : null);
            await removeFile(newAttachment ? path.join(FILE_UPLOAD_DIR, newAttachment) : null);
            return res.status(422).render("board/edit", {
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
                csrfToken: typeof req.csrfToken === "function" ? req.csrfToken() : null,
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
            await removeFile(newImage ? path.join(IMAGE_UPLOAD_DIR, newImage) : null);
            await removeFile(newAttachment ? path.join(FILE_UPLOAD_DIR, newAttachment) : null);
            return next(new HttpError(404, "Not Found"));
        }

        if (newImage && post.imageUrl) {
            const previousName = path.basename(post.imageUrl);
            await removeFile(path.join(IMAGE_UPLOAD_DIR, previousName));
        }

        if (newAttachment && post.fileUrl) {
            const previousName = path.basename(post.fileUrl);
            await removeFile(path.join(FILE_UPLOAD_DIR, previousName));
        }

        return res.redirect(`/board/${post.boardSlug}/${post.displayId}`);
    } catch (err) {
        return next(err);
    }
}

// NOTE: session-based auth required for deletes.
export async function deleteBoardPost(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        const displayId = Number(req.params.displayId);
        const { viewerUserId, isAuthenticated, isAdmin } = getViewerContext(req);

        if (!slug) {
            return next(new HttpError(404, "Not Found"));
        }

        if (!Number.isFinite(displayId) || displayId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        if (!isAuthenticated) {
            return next(new HttpError(401, "Unauthorized"));
        }

        const policy = getBoardWritePolicy(slug);
        let deleted = false;

        if (policy.delete === "admin") {
            if (!isAdmin) {
                return next(new HttpError(403, "Forbidden"));
            }
            deleted = await softDeletePostBySlugDisplayIdAsAdmin({ slug, displayId });
        } else {
            deleted = await softDeletePostBySlugDisplayId({
                slug,
                displayId,
                requestUserId: viewerUserId,
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

type BoardPostRow = {
    board_id: number;
    board_name: string;
    board_slug: string;
    display_id: number;
    user_id: number;
    title: string;
    username: string;
    content: string;
    image_url: string | null;
    file_url: string | null;
    created_at: Date;
    updated_at: Date | null;
};

type BoardPost = {
    board_slug: string;
    display_id: number;
    title: string;
    username: string;
    content: string;
    image_url: string | null;
    file_url: string | null;
    file_name: string | null;
    created_at: string;
    updated_at: string | null;
    user_id: number;
    board_name: string;
};

type NeighborRow = { display_id: number; title: string };
type Neighbor = { display_id: number; title: string } | null;

export async function getBoardShow(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        const displayId = Number(req.params.displayId);

        if (!slug) {
            return next(new HttpError(404, "Not Found"));
        }

        if (!Number.isFinite(displayId) || displayId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const board = await findBoardBySlug(slug);
        if (!board) {
            return next(new HttpError(404, "Not Found"));
        }

        const viewerContext = getViewerContext(req);
        const readAccessResult = getBoardReadAccessResult(board, viewerContext);
        if (readAccessResult === "unauthorized") {
            return next(new HttpError(401, "Unauthorized"));
        }
        if (readAccessResult === "forbidden") {
            return next(new HttpError(403, "Forbidden"));
        }

        const postRows = await sequelize.query<BoardPostRow>(
            `
            SELECT
                b.board_id,
                b.name AS board_name,
                b.slug AS board_slug,
                p.display_id,
                p.user_id,
                p.title,
                u.username,
                p.content,
                p.image_url,
                p.file_url,
                p.created_at,
                p.updated_at
            FROM posts p
            JOIN boards b ON p.board_id = b.board_id
            JOIN users u ON p.user_id = u.user_id
            WHERE b.slug = :slug
              AND p.display_id = :displayId
              AND p.use_yn = true
            LIMIT 1
            `,
            {
                type: QueryTypes.SELECT,
                replacements: { slug, displayId },
            }
        );

        const postRow = postRows[0];

        if (!postRow) {
            return next(new HttpError(404, "Not Found"));
        }

        const post: BoardPost = {
            board_slug: postRow.board_slug,
            display_id: Number(postRow.display_id),
            title: postRow.title,
            username: postRow.username,
            content: postRow.content,
            image_url: buildPostImageUrl(postRow.image_url),
            file_url: buildPostFileUrl(postRow.file_url),
            file_name: postRow.file_url ? path.basename(postRow.file_url) : null,
            created_at: new Date(postRow.created_at).toISOString(),
            updated_at: postRow.updated_at ? new Date(postRow.updated_at).toISOString() : null,
            user_id: Number(postRow.user_id),
            board_name: postRow.board_name,
        };

        const boardId = Number(postRow.board_id);
        const { viewerUserId, isAdmin } = viewerContext;
        const canReadPost = canReadPostForBoard(board, viewerContext, post.user_id);
        if (!canReadPost) {
            return next(new HttpError(403, "Forbidden"));
        }

        const writePolicy = getBoardWritePolicy(slug);
        const isOwner = viewerUserId === post.user_id;
        const canEdit = writePolicy.update === "admin" ? isAdmin : isOwner;
        const canDelete = writePolicy.delete === "admin" ? isAdmin : isOwner || isAdmin;
        const neighborVisibilityPredicate =
            board.readAccess === "owner_or_admin" && !isAdmin
                ? " AND user_id = :viewerUserId"
                : "";
        const neighborReplacements =
            board.readAccess === "owner_or_admin" && !isAdmin
                ? { boardId, displayId, viewerUserId }
                : { boardId, displayId };

        const prevRows = await sequelize.query<NeighborRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id < :displayId
              ${neighborVisibilityPredicate}
            ORDER BY display_id DESC
            LIMIT 1
            `,
            {
                type: QueryTypes.SELECT,
                replacements: neighborReplacements,
            }
        );
        const prevPost: Neighbor = prevRows[0]
            ? { display_id: Number(prevRows[0].display_id), title: prevRows[0].title }
            : null;

        const nextRows = await sequelize.query<NeighborRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id > :displayId
              ${neighborVisibilityPredicate}
            ORDER BY display_id ASC
            LIMIT 1
            `,
            {
                type: QueryTypes.SELECT,
                replacements: neighborReplacements,
            }
        );
        const nextPost: Neighbor = nextRows[0]
            ? { display_id: Number(nextRows[0].display_id), title: nextRows[0].title }
            : null;

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



