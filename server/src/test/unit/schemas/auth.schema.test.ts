import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseForgotPasswordForm,
  parseLoginForm,
  parseRegisterForm,
  parseResetPasswordForm,
} from '../../../schemas/auth.schema.js';

test('parseLoginForm trims username and keeps password', () => {
  const result = parseLoginForm({
    username: '  alice  ',
    password: ' secret ',
    captchaAnswer: ' 12 ',
    next: ' /board ',
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.username, 'alice');
  assert.equal(result.data.password, ' secret ');
  assert.equal(result.data.captchaAnswer, '12');
  assert.equal(result.data.next, '/board');
});

test('parseLoginForm fails when required credentials are missing', () => {
  const result = parseLoginForm({
    username: '   ',
    password: '',
  });

  assert.equal(result.success, false);
});

test('parseRegisterForm normalizes username and password', () => {
  const result = parseRegisterForm({
    username: '  new-user ',
    password: '1234',
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.username, 'new-user');
  assert.equal(result.data.password, '1234');
});

test('parseForgotPasswordForm trims username', () => {
  const result = parseForgotPasswordForm({
    username: '  alice ',
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.username, 'alice');
});

test('parseResetPasswordForm requires password/confirmPassword', () => {
  const invalid = parseResetPasswordForm({
    password: '',
    confirmPassword: '',
  });
  assert.equal(invalid.success, false);

  const valid = parseResetPasswordForm({
    password: 'new-password-123',
    confirmPassword: 'new-password-123',
  });
  assert.equal(valid.success, true);
});
