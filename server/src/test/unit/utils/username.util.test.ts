import assert from "node:assert/strict";
import test from "node:test";
import { isPublicProfileHandle, isValidUsername } from "../../../utils/username.util.js";

test("isValidUsername enforces 3~50 characters", () => {
    assert.equal(isValidUsername("ab"), false);
    assert.equal(isValidUsername("abc"), true);
    assert.equal(isValidUsername("a".repeat(50)), true);
    assert.equal(isValidUsername("a".repeat(51)), false);
});

test("isPublicProfileHandle rejects empty and @-prefixed values", () => {
    assert.equal(isPublicProfileHandle(""), false);
    assert.equal(isPublicProfileHandle("@alice"), false);
    assert.equal(isPublicProfileHandle("alice"), true);
});
