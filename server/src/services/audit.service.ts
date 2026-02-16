/**
 * 감사로그(Audit) 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 컨트롤러/미들웨어 import 경로를 단순화(`../services/audit.service.js`)합니다.
 * - 저장/조회(`audit-log`)를 한 곳에서 노출합니다.
 */

export { writeAdminAuditLog, writeAdminAuditLogSafely, listAdminAuditLogs } from "./audit/audit-log.service.js";
