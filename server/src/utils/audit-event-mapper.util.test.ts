import assert from "node:assert/strict";
import test from "node:test";
import {
    buildAccountStatusChangedAuditLogWriteParams,
    buildAdminPageAccessAttemptAuditLogWriteParams,
    buildAdminRoleChangedAuditLogWriteParams,
    buildAuthzDeniedAuditLogWriteParams,
    buildCsrfInvalidAuditLogWriteParams,
    buildLoginFailedAuditLogWriteParams,
    buildLoginSuccessAuditLogWriteParams,
    buildLogoutSuccessAuditLogWriteParams,
} from "./audit-event-mapper.util.js";

test("buildLoginFailedAuditLogWriteParams maps action/details", () => {
    const payload = buildLoginFailedAuditLogWriteParams({
        actorUsername: "alice",
        targetUserId: 12,
        targetUsername: "alice",
        attemptedUsername: "alice",
        reason: "invalid_credentials",
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "LOGIN_FAILED");
    assert.deepEqual(payload.details, {
        loginResult: "failure",
        reason: "invalid_credentials",
        attemptedUsername: "alice",
    });
});

test("buildLoginSuccessAuditLogWriteParams maps action/details", () => {
    const payload = buildLoginSuccessAuditLogWriteParams({
        userId: 1,
        username: "admin",
        userRole: "admin",
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "LOGIN");
    assert.deepEqual(payload.details, {
        loginResult: "success",
        userRole: "admin",
    });
});

test("buildLogoutSuccessAuditLogWriteParams maps nullish role", () => {
    const payload = buildLogoutSuccessAuditLogWriteParams({
        userId: 1,
        username: "admin",
        userRole: undefined,
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "LOGOUT");
    assert.deepEqual(payload.details, {
        logoutResult: "success",
        userRole: null,
    });
});

test("buildAdminPageAccessAttemptAuditLogWriteParams maps action/details", () => {
    const payload = buildAdminPageAccessAttemptAuditLogWriteParams({
        actorUserId: 1,
        actorUsername: "admin",
        result: "forbidden",
        reason: "admin_role_required",
        method: "GET",
        path: "/admin",
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "ADMIN_PAGE_ACCESS_ATTEMPT");
    assert.deepEqual(payload.details, {
        result: "forbidden",
        reason: "admin_role_required",
        method: "GET",
        path: "/admin",
    });
});

test("buildAuthzDeniedAuditLogWriteParams maps action/details", () => {
    const payload = buildAuthzDeniedAuditLogWriteParams({
        actorUserId: 1,
        actorUsername: "admin",
        reason: "forbidden",
        method: "POST",
        path: "/admin/users",
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "AUTHZ_DENIED");
    assert.deepEqual(payload.details, {
        method: "POST",
        path: "/admin/users",
        reason: "forbidden",
    });
});

test("buildCsrfInvalidAuditLogWriteParams maps fixed reason", () => {
    const payload = buildCsrfInvalidAuditLogWriteParams({
        actorUserId: 1,
        actorUsername: "admin",
        method: "POST",
        path: "/admin/users",
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "CSRF_INVALID");
    assert.deepEqual(payload.details, {
        method: "POST",
        path: "/admin/users",
        reason: "invalid_csrf_token",
    });
});

test("buildAccountStatusChangedAuditLogWriteParams maps action/details", () => {
    const payload = buildAccountStatusChangedAuditLogWriteParams({
        actorUserId: 1,
        actorUsername: "admin",
        targetUserId: 2,
        targetUsername: "bob",
        previousStatus: "active",
        currentStatus: "inactive",
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "ACCOUNT_DEACTIVATED");
    assert.deepEqual(payload.details, {
        previousStatus: "active",
        currentStatus: "inactive",
    });
});

test("buildAdminRoleChangedAuditLogWriteParams maps action/details", () => {
    const payload = buildAdminRoleChangedAuditLogWriteParams({
        actorUserId: 1,
        actorUsername: "admin",
        targetUserId: 2,
        targetUsername: "bob",
        previousRole: "user",
        currentRole: "admin",
        ipAddress: "127.0.0.1",
        userAgent: "UA",
    });

    assert.equal(payload.action, "ADMIN_GRANTED");
    assert.deepEqual(payload.details, {
        previousRole: "user",
        currentRole: "admin",
    });
});
