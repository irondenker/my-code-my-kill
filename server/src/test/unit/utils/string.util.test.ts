import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeString, truncateString } from '../../../utils/string.util.js';

test('normalizeString trims value and applies fallback', () => {
  assert.equal(normalizeString('  hello '), 'hello');
  assert.equal(normalizeString('   '), '');
  assert.equal(normalizeString('   ', 'fallback'), 'fallback');
  assert.equal(normalizeString(undefined, null), null);
});

test('truncateString trims first and then truncates', () => {
  assert.equal(truncateString('  abcdef  ', 4), 'abcd');
  assert.equal(truncateString('  ab  ', 10), 'ab');
  assert.equal(truncateString(undefined, 5, 'x'), 'x');
  assert.equal(truncateString(undefined, 5, null), null);
});
