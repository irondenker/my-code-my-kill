import type { AuditAction } from "./audit-action.types.js";

/**
 * 감사로그 콘솔 출력 함수에 전달하는 입력 파라미터 타입입니다.
 * CLI는 동작 확인 목적이므로 한 줄 key=value 형태로 요약 출력합니다.
 */
export type EmitAuditCliLogParams = {
    result: "success" | "failure";
    action: AuditAction;
    actor?: string | null;
    target?: string | null;
    reason?: string;
    error?: unknown;
};
