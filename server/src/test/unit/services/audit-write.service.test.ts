import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

type AuditProbeResult = {
    queryCallCount: number;
    logs: {
        log: string[];
        error: string[];
        warn: string[];
    };
    writeAuditLogError: string | null;
    safeWrapperThrew: boolean;
};

const AUDIT_PROBE_SCRIPT = `
const level = process.env.AUDIT_TEST_LEVEL;
const mode = process.env.AUDIT_TEST_MODE ?? "success";
if (typeof level === "string") {
    process.env.AUDIT_CLI_LOG_LEVEL = level;
}

const logs = { log: [], error: [], warn: [] };
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
    logs.log.push(args.map((arg) => String(arg)).join(" "));
};
console.error = (...args) => {
    logs.error.push(args.map((arg) => String(arg)).join(" "));
};
console.warn = (...args) => {
    logs.warn.push(args.map((arg) => String(arg)).join(" "));
};

const { sequelize } = await import("./src/db/index.ts");
let queryCallCount = 0;
sequelize.query = async () => {
    queryCallCount += 1;
    if (mode === "db-fail") {
        throw new Error("forced-db-failure");
    }
    return [];
};

const { writeAuditLog, writeAuditLogSafely } = await import("./src/services/audit/audit-write.service.ts");

let writeAuditLogError = null;
try {
    await writeAuditLog({
        action: "LOGIN",
        actorUserId: 1,
        actorUsername: "tester",
        details: { reason: "unit" },
    });
} catch (err) {
    writeAuditLogError = err instanceof Error ? err.message : String(err);
}

let safeWrapperThrew = false;
try {
    await writeAuditLogSafely({
        action: "LOGIN",
        actorUserId: 1,
        actorUsername: "tester",
        details: { reason: "unit-safe" },
    });
} catch {
    safeWrapperThrew = true;
}

console.log = originalLog;
console.error = originalError;
console.warn = originalWarn;

originalLog(JSON.stringify({
    queryCallCount,
    logs,
    writeAuditLogError,
    safeWrapperThrew,
}));
`;

async function runAuditProbe(env: Record<string, string>): Promise<AuditProbeResult> {
    const { stdout } = await runTsxInlineScript({
        script: AUDIT_PROBE_SCRIPT,
        env: {
            DB_NAME: "test_db",
            DB_USER: "test_user",
            DB_PASSWORD: "test_password",
            ...env,
        },
    });

    return JSON.parse(stdout.trim()) as AuditProbeResult;
}

test("audit write respects AUDIT_CLI_LOG_LEVEL=none for success and safe wrapper", async () => {
    const result = await runAuditProbe({
        AUDIT_TEST_LEVEL: "none",
        AUDIT_TEST_MODE: "success",
    });

    assert.equal(result.queryCallCount, 2);
    assert.equal(result.writeAuditLogError, null);
    assert.equal(result.safeWrapperThrew, false);
    assert.deepEqual(result.logs.log, []);
    assert.deepEqual(result.logs.error, []);
    assert.deepEqual(result.logs.warn, []);
});

test("audit write emits failure logs on AUDIT_CLI_LOG_LEVEL=errors and safe wrapper swallows", async () => {
    const result = await runAuditProbe({
        AUDIT_TEST_LEVEL: "errors",
        AUDIT_TEST_MODE: "db-fail",
    });

    assert.equal(result.queryCallCount, 2);
    assert.equal(result.writeAuditLogError, "forced-db-failure");
    assert.equal(result.safeWrapperThrew, false);
    assert.equal(result.logs.log.length, 0);
    assert.equal(result.logs.error.some((line) => line.includes("[AUDIT]")), true);
    assert.equal(result.logs.error.some((line) => line.includes("[AUDIT_LOG_ERROR]")), true);
});

test("audit write emits success logs on AUDIT_CLI_LOG_LEVEL=all", async () => {
    const result = await runAuditProbe({
        AUDIT_TEST_LEVEL: "all",
        AUDIT_TEST_MODE: "success",
    });

    assert.equal(result.queryCallCount, 2);
    assert.equal(result.writeAuditLogError, null);
    assert.equal(result.safeWrapperThrew, false);
    assert.equal(result.logs.log.some((line) => line.includes("[AUDIT]")), true);
    assert.deepEqual(result.logs.error, []);
});

test("audit write warns and falls back to none for invalid AUDIT_CLI_LOG_LEVEL", async () => {
    const result = await runAuditProbe({
        AUDIT_TEST_LEVEL: "invalid-level",
        AUDIT_TEST_MODE: "success",
    });

    assert.equal(result.queryCallCount, 2);
    assert.equal(result.writeAuditLogError, null);
    assert.equal(result.safeWrapperThrew, false);
    assert.equal(result.logs.warn.some((line) => line.includes("Invalid AUDIT_CLI_LOG_LEVEL")), true);
    assert.deepEqual(result.logs.log, []);
    assert.deepEqual(result.logs.error, []);
});
