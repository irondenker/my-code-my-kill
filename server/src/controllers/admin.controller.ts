/**
 * 어드민 컨트롤러 배럴 파일입니다.
 *
 * 분할 원칙:
 * - 유즈케이스 단위로 컨트롤러를 분리합니다.
 *   - dashboard: 대시보드 통계
 *   - users: 사용자 상태/권한 관리
 *   - boards: 게시판 생성/수정 관리
 * - 라우트 import 경로 호환성을 위해 기존 경로(`controllers/admin.controller`)에서 재노출합니다.
 */

export { getAdminDashboard } from './admin/admin-dashboard.controller.js';
export {
  getAdminUsersPage,
  postAdminUserRole,
  postAdminUserStatus,
} from './admin/admin-users.controller.js';
export {
  getAdminBoardEditPage,
  getAdminBoardsPage,
  postAdminBoardCreate,
  postAdminBoardEdit,
} from './admin/admin-boards.controller.js';
