/**
 * 어드민 서비스 배럴 파일입니다.
 *
 * 목적:
 * - 컨트롤러 import 경로를 단순화(`../services/admin.service.js`)합니다.
 * - 실제 구현은 `services/admin/` 하위로 위임합니다.
 */

export {
    listUsersForAdmin,
    updateUserActiveStatus,
    findUserMetaForAdminById,
    countAdminUsers,
    updateUserRole,
    deleteUserForAdmin,
} from "./admin/user-management.service.js";

export {
    adminUpdateUserRole,
    adminUpdateUserStatus,
} from "./admin/admin-user.usecases.service.js";

export type { AdminAuditContext } from "./admin/admin-user.usecases.service.js";
