import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeRecord } from '../../../utils/record.util.js';

test('sanitizeRecord returns empty object for non-object values', () => {
  assert.deepEqual(sanitizeRecord(null), {});
  assert.deepEqual(sanitizeRecord(undefined), {});
  assert.deepEqual(sanitizeRecord('text'), {});
  assert.deepEqual(sanitizeRecord(123), {});
  assert.deepEqual(sanitizeRecord(true), {});
  assert.deepEqual(sanitizeRecord(['a', 'b']), {});
});

test('sanitizeRecord returns original record for plain objects', () => {
  const source: Record<string, unknown> = {
    action: 'LOGIN',
    nested: { ok: true },
    count: 3,
  };
  const sanitized = sanitizeRecord(source);

  assert.equal(sanitized, source);
  assert.equal(sanitized.action, 'LOGIN');
  assert.deepEqual(sanitized.nested, { ok: true });
  assert.equal(sanitized.count, 3);
});
