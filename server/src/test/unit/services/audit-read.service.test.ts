import assert from 'node:assert/strict';
import test from 'node:test';
import { runTsxInlineScript } from '../../helpers/subprocess-test.helpers.js';

type AuditReadProbeResult = {
  appliedLimit: number | null;
  logs: Array<{
    auditLogId: number;
    action: string;
    details: Record<string, unknown>;
  }>;
  warnings: string[];
};

const AUDIT_READ_PROBE_SCRIPT = `
const limit = Number(process.env.AUDIT_READ_LIMIT ?? "200");
const mode = process.env.AUDIT_READ_MODE ?? "valid-only";

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => {
    warnings.push(args.map((arg) => String(arg)).join(" "));
};

const { sequelize } = await import("./src/db/index.ts");
let appliedLimit = null;

sequelize.query = async (_sql, options = {}) => {
    const replacements = options && options.replacements ? options.replacements : {};
    appliedLimit = Number(replacements.limit ?? 0);

    if (mode === "mixed-actions") {
        return [
            {
                audit_log_id: 1,
                action: "LOGIN",
                actor_user_id: 10,
                actor_username: "admin",
                target_user_id: null,
                target_username: null,
                details: { reason: "ok" },
                ip_address: "127.0.0.1",
                user_agent: "ua",
                created_at: new Date().toISOString(),
            },
            {
                audit_log_id: 2,
                action: "NOT_SUPPORTED",
                actor_user_id: null,
                actor_username: null,
                target_user_id: null,
                target_username: null,
                details: { ignored: true },
                ip_address: null,
                user_agent: null,
                created_at: new Date().toISOString(),
            },
        ];
    }

    if (mode === "non-record-details") {
        return [
            {
                audit_log_id: 3,
                action: "LOGIN",
                actor_user_id: 11,
                actor_username: "tester",
                target_user_id: null,
                target_username: null,
                details: ["not", "record"],
                ip_address: null,
                user_agent: null,
                created_at: new Date().toISOString(),
            },
        ];
    }

    return [
        {
            audit_log_id: 9,
            action: "LOGIN",
            actor_user_id: 1,
            actor_username: "admin",
            target_user_id: null,
            target_username: null,
            details: { reason: "default" },
            ip_address: null,
            user_agent: null,
            created_at: new Date().toISOString(),
        },
    ];
};

const { listAuditLogs } = await import("./src/services/audit/audit-read.service.ts");
const logs = await listAuditLogs(limit);

console.warn = originalWarn;
console.log(JSON.stringify({ appliedLimit, logs, warnings }));
`;

async function runAuditReadProbe(params: {
  limit: number;
  mode: string;
}): Promise<AuditReadProbeResult> {
  const { stdout } = await runTsxInlineScript({
    script: AUDIT_READ_PROBE_SCRIPT,
    env: {
      DB_NAME: 'test_db',
      DB_USER: 'test_user',
      DB_PASSWORD: 'test_password',
      AUDIT_READ_LIMIT: String(params.limit),
      AUDIT_READ_MODE: params.mode,
    },
  });

  return JSON.parse(stdout.trim()) as AuditReadProbeResult;
}

test('listAuditLogs clamps limit to max 500', async () => {
  const result = await runAuditReadProbe({ limit: 9999, mode: 'valid-only' });
  assert.equal(result.appliedLimit, 500);
});

test('listAuditLogs clamps limit to min 1', async () => {
  const result = await runAuditReadProbe({ limit: 0, mode: 'valid-only' });
  assert.equal(result.appliedLimit, 1);
});

test('listAuditLogs skips unsupported actions and warns', async () => {
  const result = await runAuditReadProbe({ limit: 200, mode: 'mixed-actions' });

  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0]?.action, 'LOGIN');
  assert.equal(
    result.warnings.some((line) => line.includes('Skipping audit_log_id=2')),
    true
  );
});

test('listAuditLogs sanitizes non-record details to empty object', async () => {
  const result = await runAuditReadProbe({ limit: 200, mode: 'non-record-details' });

  assert.equal(result.logs.length, 1);
  assert.deepEqual(result.logs[0]?.details, {});
});
