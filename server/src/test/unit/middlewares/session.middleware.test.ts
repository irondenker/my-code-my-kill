import assert from 'node:assert/strict';
import test from 'node:test';
import { runTsxInlineScript } from '../../helpers/subprocess-test.helpers.js';

type SessionMiddlewareProbeResult = {
  ok: boolean;
  error: string | null;
  middlewareType: string | null;
};

const SESSION_MIDDLEWARE_PROBE_SCRIPT = `
const mode = process.env.SESSION_TEST_MODE ?? "dev-default";

for (const key of ["NODE_ENV", "SESSION_SECRET"]) {
    delete process.env[key];
}

if (mode === "prod-missing-secret") {
    process.env.NODE_ENV = "production";
}

if (mode === "prod-with-secret") {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "prod-secret";
}

if (mode === "dev-default") {
    process.env.NODE_ENV = "development";
}

let ok = true;
let error = null;
let middlewareType = null;

try {
    const { createSessionMiddleware } = await import("./src/middlewares/session.middleware.ts");
    const middleware = createSessionMiddleware();
    middlewareType = typeof middleware;
} catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : String(err);
}

console.log(JSON.stringify({ ok, error, middlewareType }));
`;

async function runSessionMiddlewareProbe(mode: string): Promise<SessionMiddlewareProbeResult> {
  const { stdout } = await runTsxInlineScript({
    script: SESSION_MIDDLEWARE_PROBE_SCRIPT,
    env: {
      SESSION_TEST_MODE: mode,
    },
  });

  return JSON.parse(stdout.trim()) as SessionMiddlewareProbeResult;
}

test('session middleware throws in production when SESSION_SECRET is missing', async () => {
  const result = await runSessionMiddlewareProbe('prod-missing-secret');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /Missing SESSION_SECRET in production\./);
});

test('session middleware loads in production when SESSION_SECRET exists', async () => {
  const result = await runSessionMiddlewareProbe('prod-with-secret');
  assert.equal(result.ok, true);
  assert.equal(result.middlewareType, 'function');
});

test('session middleware loads in development with default secret fallback', async () => {
  const result = await runSessionMiddlewareProbe('dev-default');
  assert.equal(result.ok, true);
  assert.equal(result.middlewareType, 'function');
});
