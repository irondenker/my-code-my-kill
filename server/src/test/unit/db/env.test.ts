import assert from 'node:assert/strict';
import test from 'node:test';
import { runTsxInlineScript } from '../../helpers/subprocess-test.helpers.js';

type DbEnvProbeResult = {
  ok: boolean;
  error: string | null;
  value: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    logging: boolean;
  } | null;
};

const DB_ENV_PROBE_SCRIPT = `
const mode = process.env.DB_ENV_TEST_MODE ?? "fallback-values";

for (const key of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_LOGGING"]) {
    delete process.env[key];
}

if (mode === "missing-required") {
    process.env.DB_USER = "tester";
    process.env.DB_PASSWORD = "tester-password";
}

if (mode === "invalid-port") {
    process.env.DB_NAME = "app";
    process.env.DB_USER = "tester";
    process.env.DB_PASSWORD = "tester-password";
    process.env.DB_PORT = "abc";
}

if (mode === "parse-values") {
    process.env.DB_HOST = "db.internal";
    process.env.DB_PORT = "6543";
    process.env.DB_NAME = "app";
    process.env.DB_USER = "tester";
    process.env.DB_PASSWORD = "tester-password";
    process.env.DB_LOGGING = "YES";
}

if (mode === "fallback-values") {
    process.env.DB_NAME = "app";
    process.env.DB_USER = "tester";
    process.env.DB_PASSWORD = "tester-password";
}

let ok = true;
let error = null;
let value = null;

try {
    const { dbEnv } = await import("./src/db/env.ts");
    value = dbEnv;
} catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : String(err);
}

console.log(JSON.stringify({ ok, error, value }));
`;

async function runDbEnvProbe(mode: string): Promise<DbEnvProbeResult> {
  const { stdout } = await runTsxInlineScript({
    script: DB_ENV_PROBE_SCRIPT,
    env: {
      DB_ENV_TEST_MODE: mode,
    },
  });

  return JSON.parse(stdout.trim()) as DbEnvProbeResult;
}

test('db env loader throws when required env is missing', async () => {
  const result = await runDbEnvProbe('missing-required');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /Missing env: DB_NAME/);
});

test('db env loader throws when numeric env is invalid', async () => {
  const result = await runDbEnvProbe('invalid-port');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /Invalid number env: DB_PORT=abc/);
});

test('db env loader parses explicit port and boolean logging values', async () => {
  const result = await runDbEnvProbe('parse-values');
  assert.equal(result.ok, true);
  assert.equal(result.value?.host, 'db.internal');
  assert.equal(result.value?.port, 6543);
  assert.equal(result.value?.logging, true);
});

test('db env loader uses fallback defaults for host/port/logging', async () => {
  const result = await runDbEnvProbe('fallback-values');
  assert.equal(result.ok, true);
  assert.equal(result.value?.host, 'localhost');
  assert.equal(result.value?.port, 5432);
  assert.equal(result.value?.logging, false);
});
