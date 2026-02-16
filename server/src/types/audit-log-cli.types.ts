import type { AdminAuditAction } from "./audit-log.types.js";

/**
 * 감사로그 콘솔 출력(outcome) 타입입니다.
 * DB의 성공/실패와 별개로 "콘솔에 어떤 형태로 남길지" 제어할 때 사용합니다.
 */
export type AdminAuditOutcome = "success" | "failure";

/**
 * 감사로그 콘솔(JSON 1줄) 출력 payload 타입입니다.
 *
 * 주의:
 * - 이 payload는 DB 저장 포맷이 아니라, 운영/디버깅을 위한 콘솔 출력 포맷입니다.
 * - 외부 파싱 도구가 붙을 수 있으므로 키 구조는 가급적 안정적으로 유지합니다.
 */
export type AdminAuditCliPayload = {
    timestamp: string;
    source: "admin_audit";
    outcome: AdminAuditOutcome;
    action: AdminAuditAction;
    actorUserId: number | null;
    actorUsername: string | null;
    targetUserId: number | null;
    targetUsername: string | null;
    details: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
};

/**
 * 감사로그 콘솔 출력 함수에 전달하는 입력 파라미터 타입입니다.
 * 실패(outcome=failure)일 때는 error를 포함할 수 있습니다.
 */
export type EmitAdminAuditCliLogParams = Omit<AdminAuditCliPayload, "timestamp" | "source"> & {
    error?: unknown;
};

