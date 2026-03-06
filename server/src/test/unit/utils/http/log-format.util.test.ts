import assert from 'node:assert/strict';
import test from 'node:test';
import { formatKvLine } from '../../../../utils/http/log-format.util.js';

test('formatKvLine auto-quotes risky strings and omits undefined by default', () => {
  const line = formatKvLine('[TEST]', {
    a: 'plain',
    b: 'has space',
    c: undefined,
    d: null,
  });

  assert.equal(line, '[TEST] a=plain b="has space" d=-');
});

test('formatKvLine can include undefined and always quote strings', () => {
  const line = formatKvLine(
    '[TEST]',
    { a: 'x', b: undefined, c: null },
    { undefinedBehavior: 'include', undefinedValue: 'NA', quoteStrings: 'always' }
  );

  assert.equal(line, '[TEST] a="x" b=NA c=-');
});

test('formatKvLine can disable string quoting', () => {
  const line = formatKvLine('[TEST]', { a: 'has space' }, { quoteStrings: 'never' });
  assert.equal(line, '[TEST] a=has space');
});
