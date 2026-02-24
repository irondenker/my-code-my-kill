import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

type AuditEventProbeResult = {
    calls: Array<{
        action: string;
        details: Record<string, unknown>;
        actorUserId: number | null;
        targetUserId: number | null;
    }>;
};

const AUDIT_EVENT_PROBE_SCRIPT = `
const mode = process.env.AUDIT_EVENT_TEST_MODE;
if (!mode) {
    throw new Error("AUDIT_EVENT_TEST_MODE is required");
}

process.env.AUDIT_CLI_LOG_LEVEL = "none";

const { sequelize } = await import("./src/db/index.ts");
const calls = [];

sequelize.query = async (_sql, options = {}) => {
    const replacements = options && options.replacements ? options.replacements : {};
    const detailsJson = String(replacements.detailsJson ?? "{}");
    let details = {};
    try {
        details = JSON.parse(detailsJson);
    } catch {
        details = {};
    }

    calls.push({
        action: String(replacements.action ?? ""),
        details,
        actorUserId: replacements.actorUserId ?? null,
        targetUserId: replacements.targetUserId ?? null,
    });

    return [];
};

const auditEvent = await import("./src/services/audit/audit-event.service.ts");

if (mode === "login-failed") {
    await auditEvent.logLoginFailedSafely({
        actorUsername: "alice",
        targetUserId: null,
        targetUsername: "alice",
        attemptedUsername: "alice",
        reason: "invalid_credentials",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else if (mode === "login-success") {
    await auditEvent.logLoginSuccessSafely({
        userId: 11,
        username: "alice",
        userRole: "user",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else if (mode === "logout-success") {
    await auditEvent.logLogoutSuccessSafely({
        userId: 11,
        username: "alice",
        userRole: "user",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else if (mode === "admin-access") {
    auditEvent.logAdminPageAccessAttemptSafely({
        actorUserId: 99,
        actorUsername: "admin",
        result: "forbidden",
        reason: "not_admin",
        method: "GET",
        path: "/admin",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
} else if (mode === "authz-denied") {
    auditEvent.logAuthzDeniedSafely({
        actorUserId: 99,
        actorUsername: "admin",
        reason: "forbidden",
        method: "GET",
        path: "/board/secret",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
} else if (mode === "csrf-invalid") {
    auditEvent.logCsrfInvalidSafely({
        actorUserId: null,
        actorUsername: null,
        method: "POST",
        path: "/login",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
} else if (mode === "account-status") {
    await auditEvent.logAccountStatusChangedSafely({
        actorUserId: 99,
        actorUsername: "admin",
        targetUserId: 21,
        targetUsername: "bob",
        previousStatus: "active",
        currentStatus: "inactive",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else if (mode === "admin-role") {
    await auditEvent.logAdminRoleChangedSafely({
        actorUserId: 99,
        actorUsername: "admin",
        targetUserId: 21,
        targetUsername: "bob",
        previousRole: "user",
        currentRole: "admin",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else if (mode === "account-locked") {
    await auditEvent.logAccountLockedSafely({
        targetUserId: 21,
        targetUsername: "bob",
        failedCount: 5,
        lockMinutes: 10,
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else if (mode === "password-reset-requested") {
    await auditEvent.logPasswordResetRequestedSafely({
        targetUserId: 21,
        targetUsername: "bob",
        requestedUsername: "bob",
        issued: true,
        tokenExpiresAt: new Date("2026-02-23T12:00:00.000Z"),
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else if (mode === "password-reset-completed") {
    await auditEvent.logPasswordResetCompletedSafely({
        targetUserId: 21,
        targetUsername: "bob",
        result: "success",
        ipAddress: "127.0.0.1",
        userAgent: "ua",
    });
} else {
    throw new Error("Unknown mode: " + mode);
}

console.log(JSON.stringify({ calls }));
`;

async function runAuditEventProbe(mode: string): Promise<AuditEventProbeResult> {
    const { stdout } = await runTsxInlineScript({
        script: AUDIT_EVENT_PROBE_SCRIPT,
        env: {
            DB_NAME: "test_db",
            DB_USER: "test_user",
            DB_PASSWORD: "test_password",
            AUDIT_EVENT_TEST_MODE: mode,
        },
    });

    return JSON.parse(stdout.trim()) as AuditEventProbeResult;
}

test("audit event wrapper maps LOGIN_FAILED payload", async () => {
    const result = await runAuditEventProbe("login-failed");
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0]?.action, "LOGIN_FAILED");
    assert.equal(result.calls[0]?.details.reason, "invalid_credentials");
});

test("audit event wrapper maps LOGIN and LOGOUT payloads", async () => {
    const login = await runAuditEventProbe("login-success");
    const logout = await runAuditEventProbe("logout-success");

    assert.equal(login.calls[0]?.action, "LOGIN");
    assert.equal(login.calls[0]?.details.loginResult, "success");

    assert.equal(logout.calls[0]?.action, "LOGOUT");
    assert.equal(logout.calls[0]?.details.logoutResult, "success");
});

test("audit event wrapper maps admin access/authz/csrf payloads", async () => {
    const adminAccess = await runAuditEventProbe("admin-access");
    const authzDenied = await runAuditEventProbe("authz-denied");
    const csrfInvalid = await runAuditEventProbe("csrf-invalid");

    assert.equal(adminAccess.calls[0]?.action, "ADMIN_PAGE_ACCESS_ATTEMPT");
    assert.equal(adminAccess.calls[0]?.details.path, "/admin");

    assert.equal(authzDenied.calls[0]?.action, "AUTHZ_DENIED");
    assert.equal(authzDenied.calls[0]?.details.reason, "forbidden");

    assert.equal(csrfInvalid.calls[0]?.action, "CSRF_INVALID");
    assert.equal(csrfInvalid.calls[0]?.details.reason, "invalid_csrf_token");
});

test("audit event wrapper maps account status and admin role payloads", async () => {
    const accountStatus = await runAuditEventProbe("account-status");
    const adminRole = await runAuditEventProbe("admin-role");
    const accountLocked = await runAuditEventProbe("account-locked");
    const passwordResetRequested = await runAuditEventProbe("password-reset-requested");
    const passwordResetCompleted = await runAuditEventProbe("password-reset-completed");

    assert.equal(accountStatus.calls[0]?.action, "ACCOUNT_DEACTIVATED");
    assert.equal(accountStatus.calls[0]?.targetUserId, 21);

    assert.equal(adminRole.calls[0]?.action, "ADMIN_GRANTED");
    assert.equal(adminRole.calls[0]?.targetUserId, 21);

    assert.equal(accountLocked.calls[0]?.action, "ACCOUNT_LOCKED");
    assert.equal(accountLocked.calls[0]?.details.failedCount, 5);

    assert.equal(passwordResetRequested.calls[0]?.action, "PASSWORD_RESET_REQUESTED");
    assert.equal(passwordResetRequested.calls[0]?.details.issued, true);

    assert.equal(passwordResetCompleted.calls[0]?.action, "PASSWORD_RESET_COMPLETED");
    assert.equal(passwordResetCompleted.calls[0]?.details.result, "success");
});
