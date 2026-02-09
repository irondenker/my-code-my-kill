import type { NextFunction, Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import { HttpError } from "../utils/http-error.js";
import {
    type BoardCreateAccess,
    type BoardReadAccess,
    createBoard,
    findBoardById,
    findBoardBySlug,
    listBoards,
    updateBoard,
} from "../services/board.service.js";
import { countAdminUsers, findUserMetaForAdminById, listUsersForAdmin, updateUserActiveStatus, updateUserRole } from "../services/auth.service.js";

const BOARD_READ_ACCESS_VALUES: readonly BoardReadAccess[] = ["public", "auth", "admin", "owner_or_admin"];
const BOARD_CREATE_ACCESS_VALUES: readonly BoardCreateAccess[] = ["auth", "admin"];

function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeNullable(value: unknown): string | null {
    const trimmed = normalizeString(value);
    return trimmed ? trimmed : null;
}

function normalizeBoardSlug(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

function normalizeBoardReadAccess(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

function normalizeBoardCreateAccess(value: unknown): string {
    return normalizeString(value).toLowerCase();
}

function isBoardReadAccess(value: string): value is BoardReadAccess {
    return BOARD_READ_ACCESS_VALUES.includes(value as BoardReadAccess);
}

function isBoardCreateAccess(value: string): value is BoardCreateAccess {
    return BOARD_CREATE_ACCESS_VALUES.includes(value as BoardCreateAccess);
}

function isValidBoardSlug(value: string): boolean {
    if (value.length < 2 || value.length > 50) {
        return false;
    }
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

type BoardFormValue = {
    slug: string;
    name: string;
    description: string;
    readAccess: BoardReadAccess;
    createAccess: BoardCreateAccess;
};

async function renderAdminBoardsIndex(
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
        formSuccess: options?.formSuccess ?? null,
        formValue: options?.formValue ?? {
            slug: "",
            name: "",
            description: "",
            readAccess: "public",
            createAccess: "auth",
        },
    });
}

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

export async function getAdminUsersPage(req: Request, res: Response, next: NextFunction) {
    try {
        const users = await listUsersForAdmin();
        const adminCount = users.filter((user) => user.userRole === "admin").length;
        const formSuccess =
            req.query?.statusUpdated === "1"
                ? "User status has been updated."
                : req.query?.roleUpdated === "1"
                    ? "User role has been updated."
                    : null;
        return res.render("admin/users/index", {
            users,
            adminCount,
            formError: null,
            formSuccess,
        });
    } catch (err) {
        return next(err);
    }
}

export async function postAdminUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const status = normalizeString(req.body?.status);
        if (status !== "active" && status !== "inactive") {
            const users = await listUsersForAdmin();
            const adminCount = users.filter((user) => user.userRole === "admin").length;
            return res.status(422).render("admin/users/index", {
                users,
                adminCount,
                formError: "Invalid status value.",
                formSuccess: null,
            });
        }

        if (Number(req.session.userId) === userId && status === "inactive") {
            const users = await listUsersForAdmin();
            const adminCount = users.filter((user) => user.userRole === "admin").length;
            return res.status(422).render("admin/users/index", {
                users,
                adminCount,
                formError: "You cannot deactivate your own admin account.",
                formSuccess: null,
            });
        }

        const target = await findUserMetaForAdminById(userId);
        if (!target) {
            return next(new HttpError(404, "Not Found"));
        }

        if (status === "inactive" && target.userRole === "admin") {
            const users = await listUsersForAdmin();
            const adminCount = users.filter((user) => user.userRole === "admin").length;
            return res.status(422).render("admin/users/index", {
                users,
                adminCount,
                formError: "Admin accounts cannot be deactivated.",
                formSuccess: null,
            });
        }

        const updated = await updateUserActiveStatus({
            userId,
            isActive: status === "active",
        });
        if (!updated) {
            return next(new HttpError(404, "Not Found"));
        }

        return res.redirect("/admin/users?statusUpdated=1");
    } catch (err) {
        return next(err);
    }
}

export async function postAdminUserRole(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(404, "Not Found"));
        }

        const role = normalizeString(req.body?.role);
        if (role !== "admin" && role !== "user") {
            const users = await listUsersForAdmin();
            const adminCount = users.filter((user) => user.userRole === "admin").length;
            return res.status(422).render("admin/users/index", {
                users,
                adminCount,
                formError: "Invalid role value.",
                formSuccess: null,
            });
        }

        const target = await findUserMetaForAdminById(userId);
        if (!target) {
            return next(new HttpError(404, "Not Found"));
        }

        const requestedRole = role as "admin" | "user";
        if (target.userRole === requestedRole) {
            return res.redirect("/admin/users?roleUpdated=1");
        }

        if (
            Number(req.session.userId) === userId &&
            target.userRole === "admin" &&
            requestedRole === "user"
        ) {
            const users = await listUsersForAdmin();
            const adminCount = users.filter((user) => user.userRole === "admin").length;
            return res.status(422).render("admin/users/index", {
                users,
                adminCount,
                formError: "You cannot revoke your own admin role.",
                formSuccess: null,
            });
        }

        if (target.userRole === "admin" && requestedRole === "user") {
            const adminCount = await countAdminUsers();
            if (adminCount <= 1) {
                const users = await listUsersForAdmin();
                return res.status(422).render("admin/users/index", {
                    users,
                    adminCount,
                    formError: "At least one admin account must remain.",
                    formSuccess: null,
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

        return res.redirect("/admin/users?roleUpdated=1");
    } catch (err) {
        return next(err);
    }
}

export async function getAdminBoardsPage(req: Request, res: Response, next: NextFunction) {
    try {
        const formSuccess = req.query?.created === "1"
            ? "Board has been created."
            : req.query?.updated === "1"
                ? "Board has been updated."
                : null;

        return await renderAdminBoardsIndex(res, {
            formSuccess,
        });
    } catch (err) {
        return next(err);
    }
}

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

        return res.redirect("/admin/boards?created=1");
    } catch (err) {
        return next(err);
    }
}

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

        return res.redirect("/admin/boards?updated=1");
    } catch (err) {
        return next(err);
    }
}
