/**
 * 감사로그(Audit) 서비스 배럴 파일입니다.
 *
 * 목적:
 * - 컨트롤러/미들웨어 import 경로를 단순화(`../services/audit.service.js`)합니다.
 * - 실제 구현은 `services/audit/` 하위로 위임합니다.
 */

export { writeAdminAuditLog, writeAdminAuditLogSafely, listAdminAuditLogs } from "./audit/admin-events.service.js";
export { logLoginFailed, logLoginSuccess, logLogoutSuccess } from "./audit/auth-events.service.js";
