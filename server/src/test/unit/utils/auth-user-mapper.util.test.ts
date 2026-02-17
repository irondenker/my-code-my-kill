import assert from "node:assert/strict";
import test from "node:test";
import { mapAuthUser, mapAuthUserPublic } from "../../../utils/auth-user-mapper.util.js";

test("mapAuthUser maps internal auth user row with numeric/bool coercion", () => {
    const mapped = mapAuthUser({
        user_id: 10,
        user_role: "admin",
        username: "root",
        password_hash: "hashed",
        is_active: true,
    });

    assert.deepEqual(mapped, {
        userId: 10,
        userRole: "admin",
        username: "root",
        passwordHash: "hashed",
        isActive: true,
    });
});

test("mapAuthUserPublic excludes password hash and maps public fields", () => {
    const mapped = mapAuthUserPublic({
        user_id: 22,
        user_role: "user",
        username: "alice",
        is_active: false,
    });

    assert.deepEqual(mapped, {
        userId: 22,
        userRole: "user",
        username: "alice",
        isActive: false,
    });
});
