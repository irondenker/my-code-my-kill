import { emitAdminAuditCliLog } from "./audit-log-cli.service.js";
import { createAdminAuditLog } from "./audit-log-db.service.js";
import {
    formatAdminAuditSafeWriteErrorLine,
    normalizeAdminAuditLogWriteInput,
} from "../../utils/admin-audit-log.util.js";
import { ADMIN_AUDIT_ACTIONS } from "../../types/audit-log.types.js";
import type {
    AdminAuditLogWriteParams,
    NormalizedAdminAuditLogWriteInput,
} from "../../types/admin-audit-write.types.js";

export type { AdminAuditAction, AdminAuditLog } from "../../types/audit-log.types.js";
export { listAdminAuditLogs } from "./audit-log-db.service.js";

/**
 * 어드민 감사로그(Admin Audit) 서비스입니다.
 *
 * 책임:
 * - 감사 이벤트를 DB에 저장하고, 조회 API를 제공합니다.
 * - 콘솔 출력은 `AUDIT_CLI_LOG_LEVEL`로 제어하며, 기본값은 `none`입니다.
 *
 * 설계 의도:
 * - 감사로그는 "DB가 원본(source of truth)"이고, 콘솔 출력은 운영 편의를 위한 보조 수단입니다.
 * - 콘솔 출력이 필요하더라도 성공 로그는 과도해지기 쉬우므로, 기본값을 `none`으로 둡니다.
 */

/**
 * DB 저장 결과를 감사로그 콘솔 출력 함수로 전달합니다.
 *
 * @param outcome 성공/실패
 * @param input 정규화된 입력
 * @param error 실패 시 에러(선택)
 */
function emitAdminAuditWriteOutcomeToCli(
    outcome: "success" | "failure",
    input: NormalizedAdminAuditLogWriteInput,
    error?: unknown
): void {
    emitAdminAuditCliLog({
        outcome,
        action: input.action,
        actorUserId: input.actorUserId,
        actorUsername: input.actorUsername,
        targetUserId: input.targetUserId,
        targetUsername: input.targetUsername,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        error,
    });
}

/**
 * 관리자 감사 로그를 DB에 저장하고, 동일 이벤트를 CLI 로그로도 남깁니다.
 *
 * 처리 순서:
 * 1) 액션 유효성 검증
 * 2) 문자열/세부정보 정규화
 * 3) DB INSERT
 * 4) 성공/실패 결과를 `[AUDIT]` JSON 로그로 출력
 *
 * @param params 감사 로그 작성 파라미터
 * @throws 지원하지 않는 액션 또는 DB 저장 실패 시 예외를 던집니다.
 */
export async function writeAdminAuditLog(params: AdminAuditLogWriteParams): Promise<void> {
    const action = params.action;
    if (!ADMIN_AUDIT_ACTIONS.includes(action)) {
        throw new Error(`Unsupported admin audit action: ${action}`);
    }

    const input = normalizeAdminAuditLogWriteInput(params);

    try {
        await createAdminAuditLog(input);
        emitAdminAuditWriteOutcomeToCli("success", input);
    } catch (err) {
        emitAdminAuditWriteOutcomeToCli("failure", input, err);
        throw err;
    }
}

/**
 * 감사로그 기록을 "절대 실패시키지 않는" 래퍼입니다.
 * 인증/인가/에러 처리 흐름을 깨지 않기 위해 예외를 삼키고 1줄 요약만 남깁니다.
 *
 * @param params 감사 로그 작성 파라미터
 */
export async function writeAdminAuditLogSafely(
    params: AdminAuditLogWriteParams
): Promise<void> {
    try {
        await writeAdminAuditLog(params);
    } catch (err) {
        console.error(formatAdminAuditSafeWriteErrorLine({ action: params.action, error: err }));
    }
}
