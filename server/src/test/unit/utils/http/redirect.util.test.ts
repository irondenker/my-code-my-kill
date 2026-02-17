import assert from "node:assert/strict";
import test from "node:test";
import { getSafeRedirectPath } from "../../../../utils/http/redirect.util.js";

test("getSafeRedirectPath keeps valid in-app relative paths", () => {
    assert.equal(getSafeRedirectPath("/", "/fallback"), "/");
    assert.equal(getSafeRedirectPath("/board", "/fallback"), "/board");
    assert.equal(getSafeRedirectPath("/board?slug=notice", "/fallback"), "/board?slug=notice");
});

test("getSafeRedirectPath falls back for unsafe or invalid redirect inputs", () => {
    const fallback = "/board";
    assert.equal(getSafeRedirectPath("", fallback), fallback);
    assert.equal(getSafeRedirectPath(undefined, fallback), fallback);
    assert.equal(getSafeRedirectPath("https://evil.example", fallback), fallback);
    assert.equal(getSafeRedirectPath("//evil.example", fallback), fallback);
    assert.equal(getSafeRedirectPath("/\\windows-path", fallback), fallback);
    assert.equal(getSafeRedirectPath("board", fallback), fallback);
});
