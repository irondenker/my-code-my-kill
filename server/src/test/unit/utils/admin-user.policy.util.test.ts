import assert from "node:assert/strict";
import test from "node:test";
import {
    validateAdminUserRolePolicy,
    validateAdminUserStatusPolicy,
} from "../../../utils/admin-user.policy.util.js";

function makeTarget(overrides: {
    userId?: number;
    username?: string;
    userRole?: "admin" | "user";
    isActive?: boolean;
} = {}) {
    return {
        userId: 2,
        username: "target",
        userRole: "admin" as const,
        isActive: true,
        ...overrides,
    };
}

test("validateAdminUserStatusPolicy returns noChange when status is unchanged", () => {
    const result = validateAdminUserStatusPolicy({
        actorUserId: 1,
        target: makeTarget({ isActive: true }),
        nextStatus: "active",
    });

    assert.deepEqual(result, { ok: true, noChange: true });
});

test("validateAdminUserStatusPolicy blocks self-admin deactivation", () => {
    const result = validateAdminUserStatusPolicy({
        actorUserId: 1,
        target: makeTarget({ userId: 1, userRole: "admin", isActive: true }),
        nextStatus: "inactive",
    });

    assert.deepEqual(result, {
        ok: false,
        message: "You cannot deactivate your own admin account.",
    });
});

test("validateAdminUserStatusPolicy blocks admin account deactivation", () => {
    const result = validateAdminUserStatusPolicy({
        actorUserId: 99,
        target: makeTarget({ userRole: "admin", isActive: true }),
        nextStatus: "inactive",
    });

    assert.deepEqual(result, {
        ok: false,
        message: "Admin accounts cannot be deactivated.",
    });
});

test("validateAdminUserStatusPolicy allows user deactivation", () => {
    const result = validateAdminUserStatusPolicy({
        actorUserId: 1,
        target: makeTarget({ userRole: "user", isActive: true }),
        nextStatus: "inactive",
    });

    assert.deepEqual(result, { ok: true });
});

test("validateAdminUserRolePolicy returns noChange when role is unchanged", () => {
    const result = validateAdminUserRolePolicy({
        actorUserId: 1,
        target: makeTarget({ userRole: "user" }),
        requestedRole: "user",
    });

    assert.deepEqual(result, { ok: true, noChange: true });
});

test("validateAdminUserRolePolicy blocks self admin role revoke", () => {
    const result = validateAdminUserRolePolicy({
        actorUserId: 1,
        target: makeTarget({ userId: 1, userRole: "admin" }),
        requestedRole: "user",
        adminCount: 2,
    });

    assert.deepEqual(result, {
        ok: false,
        message: "You cannot revoke your own admin role.",
    });
});

test("validateAdminUserRolePolicy blocks demotion when only one admin remains", () => {
    const result = validateAdminUserRolePolicy({
        actorUserId: 1,
        target: makeTarget({ userId: 2, userRole: "admin" }),
        requestedRole: "user",
        adminCount: 1,
    });

    assert.deepEqual(result, {
        ok: false,
        message: "At least one admin account must remain.",
    });
});

test("validateAdminUserRolePolicy allows demotion when multiple admins exist", () => {
    const result = validateAdminUserRolePolicy({
        actorUserId: 1,
        target: makeTarget({ userId: 2, userRole: "admin" }),
        requestedRole: "user",
        adminCount: 2,
    });

    assert.deepEqual(result, { ok: true });
});
