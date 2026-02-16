import type { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import { HttpError } from "../utils/http-error.js";
import {
    findBoardById,
    findBoardBySlug,
    listBoards,
} from "../services/board.service.js";
import {
    adminCreateBoard,
    adminUpdateBoard,
    adminUpdateUserRole,
    adminUpdateUserStatus,
    countAdminUsers,
    findUserMetaForAdminById,
    listUsersForAdmin,
} from "../services/admin.service.js";
import { listAdminAuditLogs } from "../services/audit.service.js";
import { isBoardCreateAccess, isBoardReadAccess, isValidBoardSlug } from "../utils/board-validation.util.js";
import {
    validateAdminUserRolePolicy,
    validateAdminUserStatusPolicy,
} from "../utils/admin-user.policy.util.js";
import { getRequestIp, getRequestUserAgent } from "../utils/request-meta.util.js";
import { normalizeLowerString, normalizeNullableString, normalizeString } from "../utils/string.util.js";
import type { AdminAuditContext } from "../services/admin.service.js";
import type { BoardFormValue } from "../types/admin.types.js";

/**
 * 어드민 컨트롤러입니다.
 *
 * 책임:
 * - `req/res/session` 기반의 HTTP 흐름 제어(렌더링/리다이렉트/상태코드)
 * - 입력값 정규화/검증(형태만) 후 서비스 호출
 * - 감사로그 컨텍스트(actor/IP/UA) 구성 후 유즈케이스 서비스로 위임
 *
 * 반대 책임(여기서 하지 않음):
 * - DB 쿼리 직접 구현(서비스로 위임)
 * - 순수 정책 판정/메시지 매핑(유틸로 위임)
 */

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
        username: normalizeNullableString(req.session.username),
    };
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
    }
) {
    const users = await listUsersForAdmin();
    const adminCount = users.filter((user) => user.userRole === "admin").length;

    return res.render("admin/users/index", {
        users,
        adminCount,
        formError: options?.formError ?? null,
        formSuccess: options?.formSuccess ?? consumeAdminUsersFlashMessage(req),
    });
}

/**
 * 어드민 유저 관리 인덱스 화면을 렌더링합니다.
 * (목록 조회 + 플래시 메시지/에러/폼 값 바인딩)
 */
export function getAdminUsersPage(req: Request, res: Response) {
    return renderAdminUsersIndex(req, res);
}

/**
 * 어드민 보드 관리 인덱스 화면을 렌더링합니다.
 * (목록 조회 + 플래시 메시지/에러/폼 값 바인딩)
 */
export function getAdminBoardsPage(req: Request, res: Response) {
    return renderAdminBoardsIndex(req, res);
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
 * 유저 관리 화면에서 에러 상태를 공통 형태로 렌더링합니다.
 * 지정한 상태 코드를 적용한 뒤 동일 인덱스 뷰를 재사용합니다.
 */
function renderAdminUsersIndexError(
    req: Request,
    res: Response,
    params: { status: number; message: string }
) {
    res.status(params.status);
    return renderAdminUsersIndex(req, res, {
        formError: params.message,
        formSuccess: null,
    });
}

/**
 * 어드민 작업 감사로그에 필요한 공통 컨텍스트를 구성합니다.
 */
function buildAdminAuditContext(req: Request): AdminAuditContext {
    const actor = getSessionActor(req);
    return {
        actorUserId: actor.userId,
        actorUsername: actor.username,
        ipAddress: getRequestIp(req),
        userAgent: getRequestUserAgent(req),
    };
}

/**
 * 어드민 대시보드 화면을 렌더링합니다.
 * (기본 통계: 사용자 수/활성 게시글 수/보드 수)
 */
export async function getAdminDashboard(_req: Request, res: Response) {
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
}

/**
 * 어드민 유저 활성/비활성 상태 변경 요청을 처리합니다.
 * 자기 자신 비활성화 금지, admin 비활성화 금지 정책을 적용합니다.
 */
export async function postAdminUserStatus(req: Request, res: Response) {
    // 1) 대상 userId/요청 status를 읽고 기본 형식을 검증합니다.
    const userId = getPositiveIntParamOrThrow(req, "userId");

    const status = normalizeString(req.body?.status);
    if (status !== "active" && status !== "inactive") {
        return renderAdminUsersIndexError(req, res, {
            status: 422,
            message: "Invalid status value.",
        });
    }

    // 2) 정책 평가를 위해 대상 유저 메타를 조회합니다.
    const target = await findUserMetaForAdminById(userId);
    if (!target) {
        throw new HttpError(404, "Not Found");
    }

    // 3) 자기 자신/관리자 보호 등 상태 변경 정책을 검증합니다.
    const isActive = status === "active";
    const statusPolicy = validateAdminUserStatusPolicy({
        actorUserId: Number(req.session.userId),
        target: {
            userId: target.userId,
            userRole: target.userRole,
            isActive: target.isActive,
        },
        nextStatus: status,
    });
    if (!statusPolicy.ok) {
        return renderAdminUsersIndexError(req, res, {
            status: 422,
            message: statusPolicy.message,
        });
    }

    // 4) 변경 사항이 없다면 서비스 호출 없이 성공 플래시만 노출합니다.
    if ("noChange" in statusPolicy && statusPolicy.noChange) {
        req.session.adminUsersFlashMessage = "User status has been updated.";
        return res.redirect("/admin/users");
    }

    // 5) 실제 변경은 서비스 계층으로 위임하고 결과를 확인합니다.
    const updated = await adminUpdateUserStatus(buildAdminAuditContext(req), {
        target,
        nextIsActive: isActive,
    });
    if (!updated) {
        throw new HttpError(404, "Not Found");
    }

    req.session.adminUsersFlashMessage = "User status has been updated.";
    return res.redirect("/admin/users");
}

/**
 * 어드민 유저 역할(user/admin) 변경 요청을 처리합니다.
 * 자기 자신의 admin 권한 회수 금지, 최소 1명 admin 유지 정책을 적용합니다.
 */
export async function postAdminUserRole(req: Request, res: Response) {
    // 1) 대상 userId/요청 role을 읽고 기본 형식을 검증합니다.
    const userId = getPositiveIntParamOrThrow(req, "userId");

    const role = normalizeString(req.body?.role);
    if (role !== "admin" && role !== "user") {
        return renderAdminUsersIndexError(req, res, {
            status: 422,
            message: "Invalid role value.",
        });
    }

    // 2) 정책 평가를 위해 대상 유저 메타를 조회합니다.
    const target = await findUserMetaForAdminById(userId);
    if (!target) {
        throw new HttpError(404, "Not Found");
    }

    // 3) admin -> user 강등 시에만 "최소 1명 admin" 검증용 카운트를 조회합니다.
    const requestedRole = role as "admin" | "user";
    const adminCount = target.userRole === "admin" && requestedRole === "user" ? await countAdminUsers() : null;
    const rolePolicy = validateAdminUserRolePolicy({
        actorUserId: Number(req.session.userId),
        target: {
            userId: target.userId,
            userRole: target.userRole,
            isActive: target.isActive,
        },
        requestedRole,
        ...(adminCount === null ? {} : { adminCount }),
    });
    if (!rolePolicy.ok) {
        return renderAdminUsersIndexError(req, res, {
            status: 422,
            message: rolePolicy.message,
        });
    }

    // 4) 변경 사항이 없다면 서비스 호출 없이 성공 플래시만 노출합니다.
    if ("noChange" in rolePolicy && rolePolicy.noChange) {
        req.session.adminUsersFlashMessage = "User role has been updated.";
        return res.redirect("/admin/users");
    }

    // 5) 실제 변경은 서비스 계층으로 위임하고 결과를 확인합니다.
    const updated = await adminUpdateUserRole(buildAdminAuditContext(req), {
        target,
        requestedRole,
    });
    if (!updated) {
        throw new HttpError(404, "Not Found");
    }

    req.session.adminUsersFlashMessage = "User role has been updated.";
    return res.redirect("/admin/users");
}

/**
 * 어드민 감사로그 조회 페이지를 렌더링합니다.
 * limit 쿼리 파라미터를 안전하게 정규화하여 적용합니다.
 */
export async function getAdminAuditLogsPage(req: Request, res: Response) {
    const queryLimit = Number(req.query?.limit);
    const limit = Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : 200;
    const logs = await listAdminAuditLogs(limit);
    return res.render("admin/audit-logs/index", {
        logs,
        selectedLimit: Math.min(Math.max(Math.trunc(limit), 1), 500),
    });
}

/**
 * 어드민 보드 생성 요청을 처리합니다.
 * 입력 검증 후 보드를 생성하고, 플래시 메시지로 결과를 전달합니다.
 */
export async function postAdminBoardCreate(req: Request, res: Response) {
    // 1) 입력값을 정규화하고, 실패 시 폼 유지에 사용할 기본 formValue를 구성합니다.
    const slug = normalizeLowerString(req.body?.slug);
    const name = normalizeString(req.body?.name);
    const description = normalizeNullableString(req.body?.description);
    const readAccess = normalizeLowerString(req.body?.readAccess);
    const createAccess = normalizeLowerString(req.body?.createAccess);
    const formValue: BoardFormValue = {
        slug,
        name,
        description: description ?? "",
        readAccess: isBoardReadAccess(readAccess) ? readAccess : "public",
        createAccess: isBoardCreateAccess(createAccess) ? createAccess : "auth",
    };

    if (!slug || !name) {
        res.status(400);
        return renderAdminBoardsIndex(req, res, {
            formError: "Slug and name are required.",
            formSuccess: null,
            formValue,
        });
    }

    // 2) 필드 단위 검증: slug/name/description 제약을 순서대로 확인합니다.
    if (!isValidBoardSlug(slug)) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Slug must be 2-50 chars and use lowercase letters, numbers, hyphens only.",
            formSuccess: null,
            formValue,
        });
    }

    if (name.length > 100) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Board name must be 100 characters or less.",
            formSuccess: null,
            formValue,
        });
    }

    if (description && description.length > 255) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Description must be 255 characters or less.",
            formSuccess: null,
            formValue,
        });
    }

    // 3) enum 필드(read/create access) 값 검증으로 예기치 않은 정책 입력을 차단합니다.
    if (!isBoardReadAccess(readAccess)) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Invalid read access value.",
            formSuccess: null,
            formValue,
        });
    }

    if (!isBoardCreateAccess(createAccess)) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Invalid create access value.",
            formSuccess: null,
            formValue,
        });
    }

    // 4) slug 중복을 점검해 보드 식별자 충돌을 방지합니다.
    const existing = await findBoardBySlug(slug);
    if (existing) {
        res.status(409);
        return renderAdminBoardsIndex(req, res, {
            formError: "This slug is already in use.",
            formSuccess: null,
            formValue,
        });
    }

    // 5) 생성 성공 시 리다이렉트 후 한 번만 보이는 플래시 메시지를 세팅합니다.
    await adminCreateBoard({
        slug,
        name,
        description,
        readAccess,
        createAccess,
    });

    req.session.adminBoardsFlashMessage = "Board has been created.";
    return res.redirect("/admin/boards");
}

/**
 * 어드민 보드 수정 폼 페이지를 렌더링합니다.
 */
export async function getAdminBoardEditPage(req: Request, res: Response) {
    const boardId = getPositiveIntParamOrThrow(req, "boardId");

    const board = await findBoardById(boardId);
    if (!board) {
        throw new HttpError(404, "Not Found");
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
}

/**
 * 어드민 보드 수정 요청을 처리합니다.
 * 입력 검증 후 보드를 업데이트하고, 플래시 메시지로 결과를 전달합니다.
 */
export async function postAdminBoardEdit(req: Request, res: Response) {
    // 1) 수정 대상 보드 존재 여부를 먼저 확인합니다.
    const boardId = getPositiveIntParamOrThrow(req, "boardId");

    const existingBoard = await findBoardById(boardId);
    if (!existingBoard) {
        throw new HttpError(404, "Not Found");
    }

    const slug = normalizeLowerString(req.body?.slug);
    const name = normalizeString(req.body?.name);
    const description = normalizeNullableString(req.body?.description);
    const readAccess = normalizeLowerString(req.body?.readAccess);
    const createAccess = normalizeLowerString(req.body?.createAccess);

    // 검증 실패 시 입력값을 유지한 채 동일 편집 폼으로 재렌더링합니다.
    const renderInvalid = (message: string, status = 422) => {
        return res.status(status).render("admin/boards/edit", {
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
    };

    // 2) 필드 단위 검증: 필수값/slug/name/description을 순서대로 점검합니다.
    if (!slug || !name) {
        return renderInvalid("Slug and name are required.", 400);
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

    // 3) enum 필드(read/create access) 값 검증으로 정책 입력 오류를 방지합니다.
    if (!isBoardReadAccess(readAccess)) {
        return renderInvalid("Invalid read access value.");
    }

    if (!isBoardCreateAccess(createAccess)) {
        return renderInvalid("Invalid create access value.");
    }

    // 4) slug를 바꾼 경우 다른 보드와 충돌하지 않는지 확인합니다.
    const slugOwner = await findBoardBySlug(slug);
    if (slugOwner && slugOwner.boardId !== boardId) {
        return renderInvalid("This slug is already in use.", 409);
    }

    // 5) 업데이트 성공 시 목록으로 이동하고 플래시 메시지를 남깁니다.
    const updated = await adminUpdateBoard({
        boardId,
        slug,
        name,
        description,
        readAccess,
        createAccess,
    });

    if (!updated) {
        throw new HttpError(404, "Not Found");
    }

    req.session.adminBoardsFlashMessage = "Board has been updated.";
    return res.redirect("/admin/boards");
}
