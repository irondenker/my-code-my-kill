import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from '../../../../utils/auth/password-reset-token.util.js';

test('generatePasswordResetToken returns 64-char hex token', () => {
  const token = generatePasswordResetToken();
  assert.match(token, /^[a-f0-9]{64}$/);
});

test('hashPasswordResetToken returns deterministic sha256 hex', () => {
  const first = hashPasswordResetToken('sample-token');
  const second = hashPasswordResetToken('sample-token');
  const third = hashPasswordResetToken('sample-token-2');

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, third);
});
