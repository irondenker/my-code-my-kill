import assert from 'node:assert/strict';
import test from 'node:test';
import { mapAuthUser, mapAuthUserPublic } from '../../../../utils/auth/auth-user-mapper.util.js';

test('mapAuthUser maps internal auth user row with numeric/bool coercion', () => {
  const lockedUntil = new Date('2026-02-23T10:00:00.000Z');
  const tokenExpiresAt = new Date('2026-02-23T10:30:00.000Z');
  const requestedAt = new Date('2026-02-23T09:55:00.000Z');
  const usedAt = new Date('2026-02-23T10:40:00.000Z');

  const mapped = mapAuthUser({
    user_id: 10,
    user_role: 'admin',
    username: 'root',
    password_hash: 'hashed',
    is_active: true,
    login_failed_count: 3,
    login_locked_until: lockedUntil,
    password_reset_required: true,
    password_reset_token_hash: 'token-hash',
    password_reset_token_expires_at: tokenExpiresAt,
    password_reset_requested_at: requestedAt,
    password_reset_used_at: usedAt,
  });

  assert.deepEqual(mapped, {
    userId: 10,
    userRole: 'admin',
    username: 'root',
    passwordHash: 'hashed',
    isActive: true,
    loginFailedCount: 3,
    loginLockedUntil: lockedUntil,
    passwordResetRequired: true,
    passwordResetTokenHash: 'token-hash',
    passwordResetTokenExpiresAt: tokenExpiresAt,
    passwordResetRequestedAt: requestedAt,
    passwordResetUsedAt: usedAt,
  });
});

test('mapAuthUserPublic excludes password hash and maps public fields', () => {
  const mapped = mapAuthUserPublic({
    user_id: 22,
    user_role: 'user',
    username: 'alice',
    is_active: false,
  });

  assert.deepEqual(mapped, {
    userId: 22,
    userRole: 'user',
    username: 'alice',
    isActive: false,
  });
});
