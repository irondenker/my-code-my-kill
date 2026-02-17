import assert from "node:assert/strict";
import test from "node:test";
import { buildViewerContext, getBoardCreateAccessResult, getBoardReadAccessResult } from "../../../../utils/board/board.policy.util.js";

test("buildViewerContext derives authentication and admin flags from session values", () => {
    const anonymous = buildViewerContext(undefined, "user");
    assert.equal(anonymous.isAuthenticated, false);
    assert.equal(anonymous.isAdmin, false);
    assert.equal(Number.isNaN(anonymous.viewerUserId), true);

    const member = buildViewerContext("12", "user");
    assert.equal(member.viewerUserId, 12);
    assert.equal(member.isAuthenticated, true);
    assert.equal(member.isAdmin, false);

    const admin = buildViewerContext(1, "admin");
    assert.equal(admin.viewerUserId, 1);
    assert.equal(admin.isAuthenticated, true);
    assert.equal(admin.isAdmin, true);
});

test("getBoardReadAccessResult enforces public/auth/admin board policies", () => {
    const anonymous = buildViewerContext(undefined, "user");
    const member = buildViewerContext(2, "user");
    const admin = buildViewerContext(1, "admin");

    assert.equal(getBoardReadAccessResult({ readAccess: "public" }, anonymous), "ok");
    assert.equal(getBoardReadAccessResult({ readAccess: "auth" }, anonymous), "unauthorized");
    assert.equal(getBoardReadAccessResult({ readAccess: "auth" }, member), "ok");

    assert.equal(getBoardReadAccessResult({ readAccess: "admin" }, anonymous), "unauthorized");
    assert.equal(getBoardReadAccessResult({ readAccess: "admin" }, member), "forbidden");
    assert.equal(getBoardReadAccessResult({ readAccess: "admin" }, admin), "ok");

    assert.equal(getBoardReadAccessResult({ readAccess: "owner_or_admin" }, anonymous), "unauthorized");
    assert.equal(getBoardReadAccessResult({ readAccess: "owner_or_admin" }, member), "ok");
});

test("getBoardCreateAccessResult returns redirect_login for unauthenticated users on auth boards", () => {
    const anonymous = buildViewerContext(undefined, "user");
    const member = buildViewerContext(2, "user");
    const admin = buildViewerContext(1, "admin");

    assert.equal(getBoardCreateAccessResult({ createAccess: "auth" }, anonymous), "redirect_login");
    assert.equal(getBoardCreateAccessResult({ createAccess: "auth" }, member), "ok");

    assert.equal(getBoardCreateAccessResult({ createAccess: "admin" }, anonymous), "forbidden");
    assert.equal(getBoardCreateAccessResult({ createAccess: "admin" }, member), "forbidden");
    assert.equal(getBoardCreateAccessResult({ createAccess: "admin" }, admin), "ok");
});
