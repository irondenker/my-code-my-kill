import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../../utils/http/http-error.js';

process.env.NODE_ENV ??= 'test';
process.env.SESSION_SECRET ??= 'test-session-secret';
process.env.DB_NAME ??= 'test_db';
process.env.DB_USER ??= 'test_user';
process.env.DB_PASSWORD ??= 'test_password';

const { requireAdminRedirect, requireAuth, requireAuthRedirect } =
  await import('../../../middlewares/auth.middleware.js');

type MockReq = {
  session: {
    userId?: number;
    userRole?: string;
    username?: string;
  };
  method: string;
  originalUrl: string;
  path: string;
  ip: string;
  get: (name: string) => string | undefined;
};

type MockRes = {
  locals: Record<string, unknown>;
  redirectCalls: string[];
  redirect: (location: string) => MockRes;
};

function makeReq(overrides: Partial<MockReq> = {}): MockReq {
  return {
    session: {},
    method: 'GET',
    originalUrl: '/admin',
    path: '/admin',
    ip: '127.0.0.1',
    get(name: string) {
      if (name.toLowerCase() === 'user-agent') {
        return 'test-agent';
      }
      return undefined;
    },
    ...overrides,
  };
}

function makeRes(): MockRes {
  const res: MockRes = {
    locals: {},
    redirectCalls: [],
    redirect(location: string) {
      res.redirectCalls.push(location);
      return res;
    },
  };
  return res;
}

test('requireAuth passes through authenticated users', () => {
  const req = makeReq({ session: { userId: 1 } });
  const res = makeRes();
  let nextArg: unknown = undefined;

  requireAuth(req as any, res as any, (err?: unknown) => {
    nextArg = err;
  });

  assert.equal(nextArg, undefined);
  assert.deepEqual(res.redirectCalls, []);
});

test('requireAuth returns HttpError(401) for unauthenticated users', () => {
  const req = makeReq();
  const res = makeRes();
  let nextArg: unknown = undefined;

  requireAuth(req as any, res as any, (err?: unknown) => {
    nextArg = err;
  });

  assert.equal(nextArg instanceof HttpError, true);
  assert.equal((nextArg as HttpError).status, 401);
  assert.equal((nextArg as HttpError).message, 'Unauthorized');
});

test('requireAuthRedirect keeps safe next path', () => {
  const req = makeReq({ originalUrl: '/board/free/new' });
  const res = makeRes();
  let nextCalled = false;

  requireAuthRedirect(req as any, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.deepEqual(res.redirectCalls, ['/login?next=%2Fboard%2Ffree%2Fnew']);
});

test('requireAuthRedirect falls back to /login for unsafe next path', () => {
  const req = makeReq({ originalUrl: 'https://evil.example' });
  const res = makeRes();

  requireAuthRedirect(req as any, res as any, () => undefined);

  assert.deepEqual(res.redirectCalls, ['/login']);
});

test('requireAdminRedirect marks non-admin request as security event and forwards HttpError(403)', () => {
  const req = makeReq({
    session: { userId: 7, userRole: 'user', username: 'alice' },
  });
  const res = makeRes();
  let nextArg: unknown = undefined;

  requireAdminRedirect(req as any, res as any, (err?: unknown) => {
    nextArg = err;
  });

  assert.equal(res.locals.securityEventLogged, true);
  assert.equal(nextArg instanceof HttpError, true);
  assert.equal((nextArg as HttpError).status, 403);
});

test('requireAdminRedirect redirects unauthenticated users to login with next path', () => {
  const req = makeReq({
    originalUrl: '/admin/users',
    path: '/admin/users',
  });
  const res = makeRes();
  let nextCalled = false;

  requireAdminRedirect(req as any, res as any, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.deepEqual(res.redirectCalls, ['/login?next=%2Fadmin%2Fusers']);
});

test('requireAdminRedirect passes admin users', () => {
  const req = makeReq({
    session: { userId: 1, userRole: 'admin', username: 'admin' },
  });
  const res = makeRes();
  let nextArg: unknown = 'not-called';

  requireAdminRedirect(req as any, res as any, (err?: unknown) => {
    nextArg = err;
  });

  assert.equal(nextArg, undefined);
  assert.equal(res.locals.securityEventLogged, undefined);
  assert.deepEqual(res.redirectCalls, []);
});
