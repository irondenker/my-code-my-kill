/**
 * 어드민 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 컨트롤러 import 경로를 단순화(`../services/admin.service.js`)합니다.
 * - 어드민 관리 기능을 한 곳에서 노출합니다.
 */

export {
  listUsersForAdmin,
  updateUserActiveStatus,
  findUserMetaForAdminById,
  countAdminUsers,
  updateUserRole,
} from './admin/admin-management.service.js';

export { adminUpdateUserRole, adminUpdateUserStatus } from './admin/admin-management.service.js';

export type { AdminAuditContext } from './admin/admin-management.service.js';
