import type { Request, Response } from "express";
import {
    adminUpdateUserRole,
    adminUpdateUserStatus,
    countAdminUsers,
    findUserMetaForAdminById,
    listUsersForAdmin,
} from "../../services/admin.service.js";
import type { AdminAuditContext } from "../../services/admin.service.js";
import { HttpError } from "../../utils/http-error.js";
import {
    validateAdminUserRolePolicy,
    validateAdminUserStatusPolicy,
} from "../../utils/admin-user.policy.util.js";
import { getRequestIp, getRequestUserAgent } from "../../utils/request-meta.util.js";
import { getPositiveIntParamOrThrow } from "../../utils/route-param.util.js";
import { normalizeString } from "../../utils/string.util.js";
import {
    parseAdminUserRoleForm,
    parseAdminUserStatusForm,
} from "../../schemas/admin.schema.js";
import type { UserRole } from "../../types/user-role.types.js";

/**
 * 현재 세션에서 감사로그 actor 정보를 구성합니다.
 * 세션이 유효하지 않으면 401 에러를 던집니다.
 */
function getSessionActor(req: Request): { userId: number; username: string | null } {
    const userId = Number(req.session.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new HttpError(401, "Unauthorized");
    }
    return {
        userId,
        username: normalizeString(req.session.username, null),
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
 * 어드민 유저 관리 인덱스 화면을 렌더링합니다.
 * (목록 조회 + 플래시 메시지/에러/폼 값 바인딩)
 */
export function getAdminUsersPage(req: Request, res: Response) {
    return renderAdminUsersIndex(req, res);
}

/**
 * 어드민 유저 활성/비활성 상태 변경 요청을 처리합니다.
 * 자기 자신 비활성화 금지, admin 비활성화 금지 정책을 적용합니다.
 */
export async function postAdminUserStatus(req: Request, res: Response) {
    // 1) 대상 userId/요청 status를 읽고 기본 형식을 검증합니다.
    const userId = getPositiveIntParamOrThrow(req, "userId");

    const parsedStatusForm = parseAdminUserStatusForm(req.body ?? {});
    const status = parsedStatusForm.success ? parsedStatusForm.data.status : normalizeString(req.body?.status);
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
        target,
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

    const parsedRoleForm = parseAdminUserRoleForm(req.body ?? {});
    const role = parsedRoleForm.success ? parsedRoleForm.data.role : normalizeString(req.body?.role);
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
    const requestedRole = role as UserRole;
    const adminCount = target.userRole === "admin" && requestedRole === "user" ? await countAdminUsers() : null;
    const rolePolicy = validateAdminUserRolePolicy({
        actorUserId: Number(req.session.userId),
        target,
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
