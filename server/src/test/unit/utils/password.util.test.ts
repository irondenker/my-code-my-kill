import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, isValidPassword, verifyPassword } from "../../../utils/password.util.js";

test("isValidPassword enforces 8~128 character length", () => {
    assert.equal(isValidPassword("1234567"), false);
    assert.equal(isValidPassword("12345678"), true);
    assert.equal(isValidPassword("a".repeat(128)), true);
    assert.equal(isValidPassword("a".repeat(129)), false);
});

test("hashPassword/verifyPassword roundtrip works", () => {
    const raw = "correct horse battery staple";
    const hashed = hashPassword(raw);

    assert.match(hashed, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
    assert.equal(verifyPassword(raw, hashed), true);
    assert.equal(verifyPassword("wrong-password", hashed), false);
});

test("verifyPassword returns false for malformed stored hash", () => {
    assert.equal(verifyPassword("password", "sha256$abc$def"), false);
    assert.equal(verifyPassword("password", "scrypt$only-two-parts"), false);
    assert.equal(verifyPassword("password", "scrypt$$"), false);
});
