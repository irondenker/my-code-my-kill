import type { NextFunction, Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import { HttpError } from "../utils/http-error.js";
import {
    createBoard,
    findBoardById,
    findBoardBySlug,
    listBoards,
    updateBoard,
} from "../services/board.service.js";
import {
    countAdminUsers,
    createUser,
    deleteUserForAdmin,
    findUserByUsername,
    findUserMetaForAdminById,
    listUsersForAdmin,
    updateUserActiveStatus,
    updateUserRole,
} from "../services/auth.service.js";
import { writeAdminAuditLog, listAdminAuditLogs } from "../services/admin-audit.service.js";
import { hashPassword } from "../utils/password.util.js";
import { isValidPassword, isValidUsername } from "../utils/auth.validation.js";
import {
    type BoardFormValue,
    type UserCreateFormValue,
    isBoardCreateAccess,
    isBoardReadAccess,
    isValidBoardSlug,
    normalizeBoardCreateAccess,
    normalizeBoardReadAccess,
    normalizeBoardSlug,
    normalizeNullable,
    normalizeString,
} from "../services/admin-input.service.js";

/**
 * 요청 IP를 문자열로 정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 IP 또는 null
 */
function getRequestIp(req: Request): string | null {
    const value = typeof req.ip === "string" ? req.ip.trim() : "";
    return value || null;
}

/**
 * 요청 User-Agent를 문자열로 정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 User-Agent 또는 null
 */
function getRequestUserAgent(req: Request): string | null {
    const value = req.get("user-agent");
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
}

/**
 * 현재 세션에서 감사로그 actor 정보를 구성합니다.
 * 세션이 유효하지 않으면 401 에러를 던집니다.
 *
 * @param req Express 요청 객체
 */
function getSessionActor(req: Request): { userId: number; username: string | null } {
    const userId = Number(req.session.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new HttpError(401, "Unauthorized");
    }
    return {
        userId,
        username: normalizeNullable(req.session.username),
    };
}

/**
 * 유저 관리 페이지 플래시 메시지를 소비합니다.
 * 한 번 읽으면 세션에서 삭제하여 중복 노출을 방지합니다.
 */
function consumeAdminUsersFlashMessage(req: Request): string | null {
    const value = req.session.adminUsersFlashMessage;
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }
    delete req.session.adminUsersFlashMessage;
    return value;
}

/**
 * 보드 관리 페이지 플래시 메시지를 소비합니다.
 * 한 번 읽으면 세션에서 삭제하여 중복 노출을 방지합니다.
 */
function consumeAdminBoardsFlashMessage(req: Request): string | null {
    const value = req.session.adminBoardsFlashMessage;
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }
    delete req.session.adminBoardsFlashMessage;
    return value;
}

/**
 * 어드민 유저 관리 인덱스 화면을 렌더링합니다.
 * (목록 조회 + 플래시 메시지/에러/폼 값 바인딩)
 */
async function renderAdminUsersIndex(
    req: Request,
    res: Response,
    options?: {
        formError?: string | null;
        formSuccess?: string | null;
        createFormValue?: UserCreateFormValue;
    }
) {
    const users = await listUsersForAdmin();
    const adminCount = users.filter((user) => user.userRole === "admin").length;

    return res.render("admin/users/index", {
        users,
        adminCount,
        formError: options?.formError ?? null,
        formSuccess: options?.formSuccess ?? consumeAdminUsersFlashMessage(req),
        createFormValue: options?.createFormValue ?? {
            username: "",
            role: "user",
            status: "active",
        },
    });
}

/**
 * 어드민 보드 관리 인덱스 화면을 렌더링합니다.
 * (목록 조회 + 플래시 메시지/에러/폼 값 바인딩)
 */
async function renderAdminBoardsIndex(
    req: Request,
    res: Response,
    options?: {
        formError?: string | null;
        formSuccess?: string | null;
        formValue?: BoardFormValue;
    }
) {
    const boards = await listBoards();
    return res.render("admin/boards/index", {
        boards,
        formError: options?.formError ?? null,
        formSuccess: options?.formSuccess ?? consumeAdminBoardsFlashMessage(req),
        formValue: options?.formValue ?? {
            slug: "",
            name: "",
            description: "",
            readAccess: "public",
            createAccess: "auth",
        },
    });
}

/**
 * 어드민 대시보드 화면을 렌더링합니다.
 * (기본 통계: 사용자 수/활성 게시글 수/보드 수)
 */
export async function getAdminDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
        const [usersCountRows, postsCountRows, boardsCountRows] = await Promise.all([
            sequelize.query<{ total_count: string }>("SELECT COUNT(*) AS total_count FROM users", {
                type: QueryTypes.SELECT,
            }),
            sequelize.query<{ total_count: string }>("SELECT COUNT(*) AS total_count FROM posts WHERE use_yn = true", {
                type: QueryTypes.SELECT,
            }),
            sequelize.query<{ total_count: string }>("SELECT COUNT(*) AS total_count FROM boards", {
                type: QueryTypes.SELECT,
            }),
        ]);

        return res.render("admin/index", {
            stats: {
                users: Number(usersCountRows[0]?.total_count ?? 0),
                posts: Number(postsCountRows[0]?.total_count ?? 0),
                boards: Number(boardsCountRows[0]?.total_count ?? 0),
            },
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 유저 관리 페이지를 렌더링합니다.
 */
export async function getAdminUsersPage(req: Request, res: Response, next: NextFunction) {
    try {
        return await renderAdminUsersIndex(req, res);
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 유저 생성 요청을 처리합니다.
 * 입력 검증 후 계정을 생성하고, 감사로그를 기록합니다.
 */
export async function postAdminUserCreate(req: Request, res: Response, next: NextFunction) {
    try {
        const username = normalizeString(req.body?.username);
        const password = String(req.body?.password ?? "");
        const role = normalizeString(req.body?.role);
        const status = normalizeString(req.body?.status);
        const createFormValue: UserCreateFormValue = {
            username,
            role: role === "admin" ? "admin" : "user",
            status: status === "inactive" ? "inactive" : "active",
        };

        if (!username || !password) {
            res.status(400);
            return await renderAdminUsersIndex(req, res, {
                formError: "Username and password are required.",
                createFormValue,
            });
        }

        if (!isValidUsername(username)) {
            res.status(422);
            return await renderAdminUsersIndex(req, res, {
                formError: "Username must be 3-50 characters.",
                createFormValue,
            });
        }

        if (!isValidPassword(password)) {
            res.status(422);
            return await renderAdminUsersIndex(req, res, {
                formError: "Password must be 8-128 characters.",
                createFormValue,
            });
        }

        if (role !== "admin" && role !== "user") {
            res.status(422);
            return await renderAdminUsersIndex(req, res, {
                formError: "Invalid role value.",
                createFormValue,
            });
        }

        if (status !== "active" && status !== "inactive") {
            res.status(422);
            return await renderAdminUsersIndex(req, res, {
                formError: "Invalid status value for new account.",
                createFormValue,
            });
        }

        const existing = await findUserByUsername(username);
        if (existing) {
            res.status(422);
            return await renderAdminUsersIndex(req, res, {
                formError: "Username is already taken.",
                createFormValue,
            });
        }

        const created = await createUser({
            username,
            passwordHash: hashPassword(password),
            userRole: role as "admin" | "user",
            isActive: status === "active",
        });

        const actor = getSessionActor(req);
        await writeAdminAuditLog({
            action: "ACCOUNT_CREATED",
            actorUserId: actor.userId,
            actorUsername: actor.username,
            targetUserId: created.userId,
            targetUsername: created.username,
            details: {
                createdRole: created.userRole,
                createdStatus: created.isActive ? "active" : "inactive",
            },
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
        });

        req.session.adminUsersFlashMessage = "User account has been created.";
        return res.redirect("/admin/users");
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 유저 삭제 요청을 처리합니다.
 * 자기 자신 삭제 금지, 최소 1명 admin 유지, 게시글 소유자 삭제 제한 등의 정책을 적용합니다.
 */
export async function postAdminUserDelete(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        if (Number(req.session.userId) === userId) {
            return await renderAdminUsersIndex(req, res, {
                formError: "You cannot delete your own account.",
            });
        }

        const target = await findUserMetaForAdminById(userId);
        if (!target) {
            return next(new HttpError(404, "Not Found"));
        }

        if (target.userRole === "admin") {
            const adminCount = await countAdminUsers();
            if (adminCount <= 1) {
                return await renderAdminUsersIndex(req, res, {
                    formError: "At least one admin account must remain.",
                });
            }
        }

        const deleted = await deleteUserForAdmin(userId);
        if (deleted === "not_found") {
            return next(new HttpError(404, "Not Found"));
        }
        if (deleted === "has_posts") {
            return await renderAdminUsersIndex(req, res, {
                formError: "Users with posts cannot be deleted. Deactivate instead.",
            });
        }

        const actor = getSessionActor(req);
        await writeAdminAuditLog({
            action: "ACCOUNT_DELETED",
            actorUserId: actor.userId,
            actorUsername: actor.username,
            targetUserId: target.userId,
            targetUsername: target.username,
            details: {
                deletedRole: target.userRole,
                deletedStatus: target.isActive ? "active" : "inactive",
            },
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
        });

        req.session.adminUsersFlashMessage = "User account has been deleted.";
        return res.redirect("/admin/users");
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 유저 활성/비활성 상태 변경 요청을 처리합니다.
 * 자기 자신 비활성화 금지, admin 비활성화 금지 정책을 적용합니다.
 */
export async function postAdminUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const status = normalizeString(req.body?.status);
        if (status !== "active" && status !== "inactive") {
            return await renderAdminUsersIndex(req, res, {
                formError: "Invalid status value.",
            });
        }

        if (Number(req.session.userId) === userId && status === "inactive") {
            return await renderAdminUsersIndex(req, res, {
                formError: "You cannot deactivate your own admin account.",
            });
        }

        const target = await findUserMetaForAdminById(userId);
        if (!target) {
            return next(new HttpError(404, "Not Found"));
        }

        if (status === "inactive" && target.userRole === "admin") {
            return await renderAdminUsersIndex(req, res, {
                formError: "Admin accounts cannot be deactivated.",
            });
        }

        const isActive = status === "active";
        if (target.isActive === isActive) {
            req.session.adminUsersFlashMessage = "User status has been updated.";
            return res.redirect("/admin/users");
        }

        const updated = await updateUserActiveStatus({ userId, isActive });
        if (!updated) {
            return next(new HttpError(404, "Not Found"));
        }

        const actor = getSessionActor(req);
        await writeAdminAuditLog({
            action: isActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
            actorUserId: actor.userId,
            actorUsername: actor.username,
            targetUserId: target.userId,
            targetUsername: target.username,
            details: {
                previousStatus: target.isActive ? "active" : "inactive",
                currentStatus: isActive ? "active" : "inactive",
            },
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
        });

        req.session.adminUsersFlashMessage = "User status has been updated.";
        return res.redirect("/admin/users");
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 유저 역할(user/admin) 변경 요청을 처리합니다.
 * 자기 자신의 admin 권한 회수 금지, 최소 1명 admin 유지 정책을 적용합니다.
 */
export async function postAdminUserRole(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const role = normalizeString(req.body?.role);
        if (role !== "admin" && role !== "user") {
            return await renderAdminUsersIndex(req, res, {
                formError: "Invalid role value.",
            });
        }

        const target = await findUserMetaForAdminById(userId);
        if (!target) {
            return next(new HttpError(404, "Not Found"));
        }

        const requestedRole = role as "admin" | "user";
        if (target.userRole === requestedRole) {
            req.session.adminUsersFlashMessage = "User role has been updated.";
            return res.redirect("/admin/users");
        }

        if (
            Number(req.session.userId) === userId &&
            target.userRole === "admin" &&
            requestedRole === "user"
        ) {
            return await renderAdminUsersIndex(req, res, {
                formError: "You cannot revoke your own admin role.",
            });
        }

        if (target.userRole === "admin" && requestedRole === "user") {
            const adminCount = await countAdminUsers();
            if (adminCount <= 1) {
                return await renderAdminUsersIndex(req, res, {
                    formError: "At least one admin account must remain.",
                });
            }
        }

        const updated = await updateUserRole({
            userId,
            userRole: requestedRole,
        });
        if (!updated) {
            return next(new HttpError(404, "Not Found"));
        }

        const actor = getSessionActor(req);
        await writeAdminAuditLog({
            action: requestedRole === "admin" ? "ADMIN_GRANTED" : "ADMIN_REVOKED",
            actorUserId: actor.userId,
            actorUsername: actor.username,
            targetUserId: target.userId,
            targetUsername: target.username,
            details: {
                previousRole: target.userRole,
                currentRole: requestedRole,
            },
            ipAddress: getRequestIp(req),
            userAgent: getRequestUserAgent(req),
        });

        req.session.adminUsersFlashMessage = "User role has been updated.";
        return res.redirect("/admin/users");
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 감사로그 조회 페이지를 렌더링합니다.
 * limit 쿼리 파라미터를 안전하게 정규화하여 적용합니다.
 */
export async function getAdminAuditLogsPage(req: Request, res: Response, next: NextFunction) {
    try {
        const queryLimit = Number(req.query?.limit);
        const limit = Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : 200;
        const logs = await listAdminAuditLogs(limit);
        return res.render("admin/audit-logs/index", {
            logs,
            selectedLimit: Math.min(Math.max(Math.trunc(limit), 1), 500),
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 보드 관리 페이지를 렌더링합니다.
 */
export async function getAdminBoardsPage(req: Request, res: Response, next: NextFunction) {
    try {
        return await renderAdminBoardsIndex(req, res);
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 보드 생성 요청을 처리합니다.
 * 입력 검증 후 보드를 생성하고, 플래시 메시지로 결과를 전달합니다.
 */
export async function postAdminBoardCreate(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = normalizeBoardSlug(req.body?.slug);
        const name = normalizeString(req.body?.name);
        const description = normalizeNullable(req.body?.description);
        const readAccess = normalizeBoardReadAccess(req.body?.readAccess);
        const createAccess = normalizeBoardCreateAccess(req.body?.createAccess);
        const formValue: BoardFormValue = {
            slug,
            name,
            description: description ?? "",
            readAccess: isBoardReadAccess(readAccess) ? readAccess : "public",
            createAccess: isBoardCreateAccess(createAccess) ? createAccess : "auth",
        };

        if (!slug || !name) {
            return res.status(400).render("admin/boards/index", {
                boards: await listBoards(),
                formError: "Slug and name are required.",
                formSuccess: null,
                formValue,
            });
        }

        if (!isValidBoardSlug(slug)) {
            return res.status(422).render("admin/boards/index", {
                boards: await listBoards(),
                formError: "Slug must be 2-50 chars and use lowercase letters, numbers, hyphens only.",
                formSuccess: null,
                formValue,
            });
        }

        if (name.length > 100) {
            return res.status(422).render("admin/boards/index", {
                boards: await listBoards(),
                formError: "Board name must be 100 characters or less.",
                formSuccess: null,
                formValue,
            });
        }

        if (description && description.length > 255) {
            return res.status(422).render("admin/boards/index", {
                boards: await listBoards(),
                formError: "Description must be 255 characters or less.",
                formSuccess: null,
                formValue,
            });
        }

        if (!isBoardReadAccess(readAccess)) {
            return res.status(422).render("admin/boards/index", {
                boards: await listBoards(),
                formError: "Invalid read access value.",
                formSuccess: null,
                formValue,
            });
        }

        if (!isBoardCreateAccess(createAccess)) {
            return res.status(422).render("admin/boards/index", {
                boards: await listBoards(),
                formError: "Invalid create access value.",
                formSuccess: null,
                formValue,
            });
        }

        const existing = await findBoardBySlug(slug);
        if (existing) {
            return res.status(409).render("admin/boards/index", {
                boards: await listBoards(),
                formError: "This slug is already in use.",
                formSuccess: null,
                formValue,
            });
        }

        await createBoard({
            slug,
            name,
            description,
            readAccess,
            createAccess,
        });

        req.session.adminBoardsFlashMessage = "Board has been created.";
        return res.redirect("/admin/boards");
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 보드 수정 폼 페이지를 렌더링합니다.
 */
export async function getAdminBoardEditPage(req: Request, res: Response, next: NextFunction) {
    try {
        const boardId = Number(req.params.boardId);
        if (!Number.isFinite(boardId) || boardId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const board = await findBoardById(boardId);
        if (!board) {
            return next(new HttpError(404, "Not Found"));
        }

        return res.render("admin/boards/edit", {
            formError: null,
            board: {
                boardId: board.boardId,
                slug: board.slug,
                name: board.name,
                description: board.description ?? "",
                readAccess: board.readAccess,
                createAccess: board.createAccess,
            },
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * 어드민 보드 수정 요청을 처리합니다.
 * 입력 검증 후 보드를 업데이트하고, 플래시 메시지로 결과를 전달합니다.
 */
export async function postAdminBoardEdit(req: Request, res: Response, next: NextFunction) {
    try {
        const boardId = Number(req.params.boardId);
        if (!Number.isFinite(boardId) || boardId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const existingBoard = await findBoardById(boardId);
        if (!existingBoard) {
            return next(new HttpError(404, "Not Found"));
        }

        const slug = normalizeBoardSlug(req.body?.slug);
        const name = normalizeString(req.body?.name);
        const description = normalizeNullable(req.body?.description);
        const readAccess = normalizeBoardReadAccess(req.body?.readAccess);
        const createAccess = normalizeBoardCreateAccess(req.body?.createAccess);

        const renderInvalid = (message: string) =>
            res.status(422).render("admin/boards/edit", {
                formError: message,
                board: {
                    boardId,
                    slug,
                    name,
                    description: description ?? "",
                    readAccess: isBoardReadAccess(readAccess) ? readAccess : existingBoard.readAccess,
                    createAccess: isBoardCreateAccess(createAccess) ? createAccess : existingBoard.createAccess,
                },
            });

        if (!slug || !name) {
            return renderInvalid("Slug and name are required.");
        }

        if (!isValidBoardSlug(slug)) {
            return renderInvalid("Slug must be 2-50 chars and use lowercase letters, numbers, hyphens only.");
        }

        if (name.length > 100) {
            return renderInvalid("Board name must be 100 characters or less.");
        }

        if (description && description.length > 255) {
            return renderInvalid("Description must be 255 characters or less.");
        }

        if (!isBoardReadAccess(readAccess)) {
            return renderInvalid("Invalid read access value.");
        }

        if (!isBoardCreateAccess(createAccess)) {
            return renderInvalid("Invalid create access value.");
        }

        const slugOwner = await findBoardBySlug(slug);
        if (slugOwner && slugOwner.boardId !== boardId) {
            return renderInvalid("This slug is already in use.");
        }

        const updated = await updateBoard({
            boardId,
            slug,
            name,
            description,
            readAccess,
            createAccess,
        });

        if (!updated) {
            return next(new HttpError(404, "Not Found"));
        }

        req.session.adminBoardsFlashMessage = "Board has been updated.";
        return res.redirect("/admin/boards");
    } catch (err) {
        return next(err);
    }
}
