/**
 * 감사로그(Audit) 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 컨트롤러/미들웨어 import 경로를 단순화(`../services/audit.service.js`)합니다.
 * - 저장/조회(`audit-write`/`audit-read`)와 이벤트 유즈케이스(`audit-events`)를 한 곳에서 노출합니다.
 */

export { listAuditLogs } from "./audit/audit-read.service.js";
export {
    logLoginFailedSafely,
    logLoginSuccessSafely,
    logLogoutSuccessSafely,
    logAdminPageAccessAttemptSafely,
    logAuthzDeniedSafely,
    logCsrfInvalidSafely,
    logAccountStatusChangedSafely,
    logAdminRoleChangedSafely,
    logAccountLockedSafely,
    logPasswordResetRequestedSafely,
    logPasswordResetCompletedSafely,
    logRateLimitedSafely,
} from "./audit/audit-event.service.js";
