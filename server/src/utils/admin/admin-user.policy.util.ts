import type { AdminPolicyResult, AdminUserStatus } from '../../types/admin/admin.types.js';
import type { AdminUserMeta } from '../../types/auth/auth.types.js';
import type { UserRole } from '../../types/user/user-role.types.js';

export type { AdminPolicyResult, AdminUserMeta, AdminUserStatus };

/**
 * 어드민 유저 활성/비활성 변경 정책을 검증합니다.
 *
 * - 자기 자신(admin)의 비활성화는 금지
 * - admin 계정은 비활성화 불가(운영 정책)
 *
 * @param params 정책 판단에 필요한 최소 정보
 */
export function validateAdminUserStatusPolicy(params: {
  actorUserId: number;
  target: AdminUserMeta;
  nextStatus: AdminUserStatus;
}): AdminPolicyResult {
  const nextIsActive = params.nextStatus === 'active';

  if (params.target.isActive === nextIsActive) {
    return { ok: true, noChange: true };
  }

  if (params.actorUserId === params.target.userId && !nextIsActive) {
    return { ok: false, message: 'You cannot deactivate your own admin account.' };
  }

  if (!nextIsActive && params.target.userRole === 'admin') {
    return { ok: false, message: 'Admin accounts cannot be deactivated.' };
  }

  return { ok: true };
}

/**
 * 어드민 유저 역할 변경(user/admin) 정책을 검증합니다.
 *
 * - 자기 자신의 admin 권한 회수 금지
 * - admin -> user 로 변경 시 최소 1명의 admin은 남아야 함
 *
 * @param params 정책 판단에 필요한 최소 정보
 */
export function validateAdminUserRolePolicy(params: {
  actorUserId: number;
  target: AdminUserMeta;
  requestedRole: UserRole;
  adminCount?: number;
}): AdminPolicyResult {
  if (params.target.userRole === params.requestedRole) {
    return { ok: true, noChange: true };
  }

  if (
    params.actorUserId === params.target.userId &&
    params.target.userRole === 'admin' &&
    params.requestedRole === 'user'
  ) {
    return { ok: false, message: 'You cannot revoke your own admin role.' };
  }

  if (params.target.userRole === 'admin' && params.requestedRole === 'user') {
    const adminCount = typeof params.adminCount === 'number' ? params.adminCount : 0;
    if (adminCount <= 1) {
      return { ok: false, message: 'At least one admin account must remain.' };
    }
  }

  return { ok: true };
}
