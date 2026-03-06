import { QueryTypes } from 'sequelize';
import { sequelize } from '../../db/index.js';
import { AUDIT_ACTIONS } from '../../types/audit/audit-action.types.js';
import type { EmitAuditCliLogParams } from '../../types/audit/audit-cli.types.js';
import { sanitizeRecord } from '../../utils/record.util.js';
import { truncateString } from '../../utils/string.util.js';
import { summarizeErrorMessage } from '../../utils/http/error-summary.util.js';
import { formatKvLine } from '../../utils/http/log-format.util.js';
import type {
  AuditLogWriteParams,
  NormalizedAuditLogWriteInput,
} from '../../types/audit/audit-log-write.types.js';

export type { AuditAction } from '../../types/audit/audit-action.types.js';

const AUDIT_LOGS_TABLE = 'audit_logs';

/**
 * 감사로그 쓰기(write) 서비스입니다.
 *
 * 책임:
 * - 감사 이벤트를 DB에 저장합니다.
 * - 콘솔 출력은 `AUDIT_CLI_LOG_LEVEL`로 제어하며, 기본값은 `none`입니다.
 *
 * 설계 의도:
 * - 감사로그는 "DB가 원본(source of truth)"이고, 콘솔 출력은 운영 편의를 위한 보조 수단입니다.
 * - 콘솔 출력이 필요하더라도 성공 로그는 과도해지기 쉬우므로, 기본값을 `none`으로 둡니다.
 */

type AuditCliLogLevel = 'none' | 'errors' | 'all';

/**
 * `AUDIT_CLI_LOG_LEVEL` 환경변수를 해석하여 콘솔 출력 레벨을 결정합니다.
 * 유효하지 않은 값이면 안전하게 `none`으로 폴백합니다.
 */
function getAuditCliLogLevel(): AuditCliLogLevel {
  const raw = String(process.env.AUDIT_CLI_LOG_LEVEL ?? 'none')
    .trim()
    .toLowerCase();
  if (raw === 'none' || raw === 'errors' || raw === 'all') {
    return raw;
  }
  console.warn(`[CONFIG] Invalid AUDIT_CLI_LOG_LEVEL="${raw}". Falling back to "none".`);
  return 'none';
}

/**
 * 현재 프로세스에서 사용할 감사로그 콘솔 출력 레벨(서버 시작 시 1회 결정)입니다.
 */
const auditCliLogLevel = getAuditCliLogLevel();

/**
 * writeAuditLogSafely 실패 시 콘솔에 남길 1줄 요약을 생성합니다.
 */
function formatAuditSafeWriteErrorLine(params: {
  action: AuditLogWriteParams['action'];
  error: unknown;
}): string {
  return formatKvLine(
    '[AUDIT_LOG_ERROR]',
    {
      action: params.action,
      reason: summarizeErrorMessage(params.error),
    },
    { quoteStrings: 'auto' }
  );
}

/**
 * 감사 로그를 Node 콘솔에 출력합니다.
 */
function emitAuditCliLog(params: EmitAuditCliLogParams): void {
  if (auditCliLogLevel === 'none') {
    return;
  }
  if (auditCliLogLevel === 'errors' && params.result === 'success') {
    return;
  }

  const line = formatKvLine(
    '[AUDIT]',
    {
      result: params.result,
      action: params.action,
      actor: params.actor ?? null,
      target: params.target ?? null,
      reason: params.reason ?? (params.error ? summarizeErrorMessage(params.error) : undefined),
    },
    { nullValue: '-', quoteStrings: 'auto' }
  );

  if (params.error) {
    console.error(line);
    return;
  }

  console.log(line);
}

function toCliPrincipalLabel(username: string | null, userId: number | null): string | null {
  if (typeof username === 'string' && username.length > 0) {
    return username;
  }
  if (typeof userId === 'number' && Number.isFinite(userId) && userId > 0) {
    return `#${String(userId)}`;
  }
  return null;
}

function toCliReason(details: Record<string, unknown>): string | undefined {
  const reason = details.reason;
  return typeof reason === 'string' && reason.length > 0 ? reason : undefined;
}

function emitAuditWriteResultToCli(
  input: NormalizedAuditLogWriteInput,
  result: 'success' | 'failure',
  error?: unknown
): void {
  const base: EmitAuditCliLogParams = {
    result,
    action: input.action,
    actor: toCliPrincipalLabel(input.actorUsername, input.actorUserId),
    target: toCliPrincipalLabel(input.targetUsername, input.targetUserId),
  };

  if (result === 'failure') {
    const reason = toCliReason(input.details);
    emitAuditCliLog({
      ...base,
      ...(reason ? { reason } : {}),
      ...(error ? { error } : {}),
    });
    return;
  }

  emitAuditCliLog(base);
}

/**
 * 감사로그 DB 저장 전용 함수입니다.
 *
 * @param input 정규화된 입력
 */
async function createAuditLog(input: NormalizedAuditLogWriteInput): Promise<void> {
  await sequelize.query(
    `
        INSERT INTO ${AUDIT_LOGS_TABLE} (
            action,
            actor_user_id,
            actor_username,
            target_user_id,
            target_username,
            details,
            ip_address,
            user_agent,
            created_at
        )
        VALUES (
            :action,
            :actorUserId,
            :actorUsername,
            :targetUserId,
            :targetUsername,
            CAST(:detailsJson AS jsonb),
            :ipAddress,
            :userAgent,
            NOW()
        )
        `,
    {
      type: QueryTypes.INSERT,
      replacements: {
        action: input.action,
        actorUserId: input.actorUserId,
        actorUsername: input.actorUsername,
        targetUserId: input.targetUserId,
        targetUsername: input.targetUsername,
        detailsJson: input.detailsJson,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    }
  );
}

/**
 * 감사로그 저장 입력을 DB 저장/CLI 출력에 적합한 형태로 정규화합니다.
 */
function normalizeAuditLogWriteInput(params: AuditLogWriteParams): NormalizedAuditLogWriteInput {
  const actorUserId = params.actorUserId ?? null;
  const targetUserId = params.targetUserId ?? null;
  const actorUsername = truncateString(params.actorUsername, 50, null);
  const targetUsername = truncateString(params.targetUsername, 50, null);
  const ipAddress = truncateString(params.ipAddress, 64, null);
  const userAgent = truncateString(params.userAgent, 255, null);
  const details = sanitizeRecord(params.details);
  const detailsJson = JSON.stringify(details);

  return {
    action: params.action,
    actorUserId,
    actorUsername,
    targetUserId,
    targetUsername,
    details,
    detailsJson,
    ipAddress,
    userAgent,
  };
}

/**
 * 관리자 감사 로그를 DB에 저장하고, 동일 이벤트를 CLI 로그로도 남깁니다.
 *
 * 처리 순서:
 * 1) 액션 유효성 검증
 * 2) 문자열/세부정보 정규화
 * 3) DB INSERT
 * 4) 성공/실패 결과를 `[AUDIT]` 요약 로그로 출력
 *
 * @param params 감사 로그 작성 파라미터
 * @throws 지원하지 않는 액션 또는 DB 저장 실패 시 예외를 던집니다.
 */
export async function writeAuditLog(params: AuditLogWriteParams): Promise<void> {
  const action = params.action;
  if (!AUDIT_ACTIONS.includes(action)) {
    throw new Error(`Unsupported audit action: ${action}`);
  }

  const input = normalizeAuditLogWriteInput(params);

  try {
    await createAuditLog(input);
    emitAuditWriteResultToCli(input, 'success');
  } catch (err) {
    emitAuditWriteResultToCli(input, 'failure', err);
    throw err;
  }
}

/**
 * 감사로그 기록을 "절대 실패시키지 않는" 래퍼입니다.
 * 인증/인가/에러 처리 흐름을 깨지 않기 위해 예외를 삼키고 1줄 요약만 남깁니다.
 *
 * @param params 감사 로그 작성 파라미터
 */
export async function writeAuditLogSafely(params: AuditLogWriteParams): Promise<void> {
  try {
    await writeAuditLog(params);
  } catch (err) {
    console.error(formatAuditSafeWriteErrorLine({ action: params.action, error: err }));
  }
}
