import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBoardListQueryCarry, normalizeBoardListQuery } from '../../../utils/query-carry.js';

test('normalizeBoardListQuery trims q and applies fallbacks', () => {
  const normalized = normalizeBoardListQuery({
    q: '   hello world   ',
    sort: 'unexpected',
    order: 'ASC',
    page: '0',
    limit: '9999',
  });

  assert.equal(normalized.q, 'hello world');
  assert.equal(normalized.sort, 'display_id');
  assert.equal(normalized.order, 'asc');
  assert.equal(normalized.page, 1);
  assert.equal(normalized.limit, 100);
});

test('buildBoardListQueryCarry keeps q/sort/order/page/limit and supports overrides', () => {
  const current = normalizeBoardListQuery({
    q: 'test',
    sort: 'display_id',
    order: 'desc',
    page: '1',
    limit: '20',
  });

  assert.equal(
    buildBoardListQueryCarry(current, { page: 2 }),
    '?q=test&sort=display_id&order=desc&page=2&limit=20'
  );
  assert.equal(
    buildBoardListQueryCarry(current, { limit: 50 }),
    '?q=test&sort=display_id&order=desc&page=1&limit=50'
  );
});
