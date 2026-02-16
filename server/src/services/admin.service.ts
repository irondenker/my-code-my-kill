/**
 * 어드민 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 컨트롤러 import 경로를 단순화(`../services/admin.service.js`)합니다.
 * - 데이터 접근(`*.data.service`)과 유즈케이스(`*.usecases.service`) 계층을 한 곳에서 노출합니다.
 */

export {
    listUsersForAdmin,
    updateUserActiveStatus,
    findUserMetaForAdminById,
    countAdminUsers,
    updateUserRole,
} from "./admin/user-management.data.service.js";

export {
    adminUpdateUserRole,
    adminUpdateUserStatus,
} from "./admin/user-management.usecases.service.js";

export type { AdminAuditContext } from "./admin/user-management.usecases.service.js";
