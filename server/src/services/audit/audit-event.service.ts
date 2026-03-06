import { summarizeErrorMessage } from '../../utils/http/error-summary.util.js';
import {
  buildAccountLockedAuditLogWriteParams,
  buildAccountStatusChangedAuditLogWriteParams,
  buildAdminPageAccessAttemptAuditLogWriteParams,
  buildAdminRoleChangedAuditLogWriteParams,
  buildAuthzDeniedAuditLogWriteParams,
  buildCsrfInvalidAuditLogWriteParams,
  buildLoginFailedAuditLogWriteParams,
  buildLoginSuccessAuditLogWriteParams,
  buildLogoutSuccessAuditLogWriteParams,
  buildPasswordResetCompletedAuditLogWriteParams,
  buildPasswordResetRequestedAuditLogWriteParams,
  buildRateLimitedAuditLogWriteParams,
} from '../../utils/audit/audit-event-mapper.util.js';
import { writeAuditLog, writeAuditLogSafely } from './audit-write.service.js';

/**
 * 로그인 실패 이벤트를 안전하게 기록합니다.
 */
export async function logLoginFailedSafely(
  params: Parameters<typeof buildLoginFailedAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildLoginFailedAuditLogWriteParams(params));
}

/**
 * 로그인 성공 이벤트를 안전하게 기록합니다.
 */
export async function logLoginSuccessSafely(
  params: Parameters<typeof buildLoginSuccessAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildLoginSuccessAuditLogWriteParams(params));
}

/**
 * 로그아웃 성공 이벤트를 안전하게 기록합니다.
 */
export async function logLogoutSuccessSafely(
  params: Parameters<typeof buildLogoutSuccessAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildLogoutSuccessAuditLogWriteParams(params));
}

/**
 * 관리자 페이지 접근 시도 이벤트를 안전하게 기록합니다.
 * 실패해도 요청 처리를 중단하지 않도록 내부에서 예외를 처리합니다.
 */
export function logAdminPageAccessAttemptSafely(
  params: Parameters<typeof buildAdminPageAccessAttemptAuditLogWriteParams>[0]
): void {
  void writeAuditLog(buildAdminPageAccessAttemptAuditLogWriteParams(params)).catch((err) => {
    console.error(
      `[AUDIT_LOG_ERROR] action=ADMIN_PAGE_ACCESS_ATTEMPT path=${params.path} reason="${summarizeErrorMessage(err)}"`
    );
  });
}

/**
 * 권한 거부(403) 이벤트를 안전하게 기록합니다.
 * 실패해도 에러 응답 처리 흐름을 중단하지 않도록 내부에서 예외를 처리합니다.
 */
export function logAuthzDeniedSafely(
  params: Parameters<typeof buildAuthzDeniedAuditLogWriteParams>[0]
): void {
  void writeAuditLog(buildAuthzDeniedAuditLogWriteParams(params)).catch((err) => {
    console.error(
      `[AUDIT_LOG_ERROR] action=AUTHZ_DENIED path=${params.path} reason="${summarizeErrorMessage(err)}"`
    );
  });
}

/**
 * CSRF 토큰 검증 실패 이벤트를 안전하게 기록합니다.
 * 실패해도 에러 응답 처리 흐름을 중단하지 않도록 내부에서 예외를 처리합니다.
 */
export function logCsrfInvalidSafely(
  params: Parameters<typeof buildCsrfInvalidAuditLogWriteParams>[0]
): void {
  void writeAuditLog(buildCsrfInvalidAuditLogWriteParams(params)).catch((err) => {
    console.error(
      `[AUDIT_LOG_ERROR] action=CSRF_INVALID path=${params.path} reason="${summarizeErrorMessage(err)}"`
    );
  });
}

/**
 * 관리자 계정 활성/비활성 변경 이벤트를 안전하게 기록합니다.
 */
export async function logAccountStatusChangedSafely(
  params: Parameters<typeof buildAccountStatusChangedAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildAccountStatusChangedAuditLogWriteParams(params));
}

/**
 * 관리자 권한 부여/회수 이벤트를 안전하게 기록합니다.
 */
export async function logAdminRoleChangedSafely(
  params: Parameters<typeof buildAdminRoleChangedAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildAdminRoleChangedAuditLogWriteParams(params));
}

export async function logAccountLockedSafely(
  params: Parameters<typeof buildAccountLockedAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildAccountLockedAuditLogWriteParams(params));
}

export async function logPasswordResetRequestedSafely(
  params: Parameters<typeof buildPasswordResetRequestedAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildPasswordResetRequestedAuditLogWriteParams(params));
}

export async function logPasswordResetCompletedSafely(
  params: Parameters<typeof buildPasswordResetCompletedAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildPasswordResetCompletedAuditLogWriteParams(params));
}

export async function logRateLimitedSafely(
  params: Parameters<typeof buildRateLimitedAuditLogWriteParams>[0]
): Promise<void> {
  await writeAuditLogSafely(buildRateLimitedAuditLogWriteParams(params));
}
