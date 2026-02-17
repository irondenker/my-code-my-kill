import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

type AdminManagementProbeResult = {
    updated: boolean;
    updateCalls: number;
    auditInsertCalls: number;
};

const ADMIN_MANAGEMENT_PROBE_SCRIPT = `
const mode = process.env.ADMIN_MGMT_TEST_MODE ?? "status-success";
process.env.AUDIT_CLI_LOG_LEVEL = "none";

const { sequelize } = await import("./src/db/index.ts");
let updateCalls = 0;
let auditInsertCalls = 0;

sequelize.query = async () => {
    // First write query is the user update. Following write query (if any) is audit insert.
    if (updateCalls === 0) {
        updateCalls += 1;
        if (mode === "status-fail" || mode === "role-fail") {
            return [];
        }
        return [{ user_id: 101 }];
    }

    auditInsertCalls += 1;
    return [];
};

const {
    adminUpdateUserStatus,
    adminUpdateUserRole,
} = await import("./src/services/admin/admin-management.service.ts");

const ctx = {
    actorUserId: 1,
    actorUsername: "admin",
    ipAddress: "127.0.0.1",
    userAgent: "unit-test",
};

let updated = false;
if (mode.startsWith("status")) {
    updated = await adminUpdateUserStatus(ctx, {
        target: {
            userId: 101,
            username: "target",
            userRole: "user",
            isActive: true,
        },
        nextIsActive: false,
    });
} else {
    updated = await adminUpdateUserRole(ctx, {
        target: {
            userId: 101,
            username: "target",
            userRole: "user",
            isActive: true,
        },
        requestedRole: "admin",
    });
}

console.log(JSON.stringify({ updated, updateCalls, auditInsertCalls }));
`;

async function runAdminManagementProbe(mode: string): Promise<AdminManagementProbeResult> {
    const { stdout } = await runTsxInlineScript({
        script: ADMIN_MANAGEMENT_PROBE_SCRIPT,
        env: {
            DB_NAME: "test_db",
            DB_USER: "test_user",
            DB_PASSWORD: "test_password",
            ADMIN_MGMT_TEST_MODE: mode,
        },
    });

    return JSON.parse(stdout.trim()) as AdminManagementProbeResult;
}

test("adminUpdateUserStatus returns false and skips audit log when update fails", async () => {
    const result = await runAdminManagementProbe("status-fail");

    assert.equal(result.updated, false);
    assert.equal(result.updateCalls, 1);
    assert.equal(result.auditInsertCalls, 0);
});

test("adminUpdateUserStatus writes audit log when update succeeds", async () => {
    const result = await runAdminManagementProbe("status-success");

    assert.equal(result.updated, true);
    assert.equal(result.updateCalls, 1);
    assert.equal(result.auditInsertCalls, 1);
});

test("adminUpdateUserRole returns false and skips audit log when update fails", async () => {
    const result = await runAdminManagementProbe("role-fail");

    assert.equal(result.updated, false);
    assert.equal(result.updateCalls, 1);
    assert.equal(result.auditInsertCalls, 0);
});

test("adminUpdateUserRole writes audit log when update succeeds", async () => {
    const result = await runAdminManagementProbe("role-success");

    assert.equal(result.updated, true);
    assert.equal(result.updateCalls, 1);
    assert.equal(result.auditInsertCalls, 1);
});
