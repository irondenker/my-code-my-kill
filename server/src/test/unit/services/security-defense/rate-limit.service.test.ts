import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeFixedWindowRateLimit } from '../../../../services/security-defense/rate-limit.service.js';

test('fixed window rate limit allows up to max requests and then blocks', () => {
  const uniqueKey = `unit-${Date.now()}-${Math.random()}`;
  const first = consumeFixedWindowRateLimit({
    bucket: 'unit-login',
    key: uniqueKey,
    maxRequests: 2,
    windowSeconds: 60,
  });
  const second = consumeFixedWindowRateLimit({
    bucket: 'unit-login',
    key: uniqueKey,
    maxRequests: 2,
    windowSeconds: 60,
  });
  const third = consumeFixedWindowRateLimit({
    bucket: 'unit-login',
    key: uniqueKey,
    maxRequests: 2,
    windowSeconds: 60,
  });

  assert.equal(first.limited, false);
  assert.equal(second.limited, false);
  assert.equal(third.limited, true);
  assert.equal(third.retryAfterSeconds > 0, true);
});
