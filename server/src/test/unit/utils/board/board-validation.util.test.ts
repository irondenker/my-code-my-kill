import assert from "node:assert/strict";
import test from "node:test";
import {
    isBoardCreateAccess,
    isBoardReadAccess,
    isValidBoardSlug,
} from "../../../../utils/board/board-validation.util.js";

test("isBoardReadAccess validates allowed values", () => {
    assert.equal(isBoardReadAccess("public"), true);
    assert.equal(isBoardReadAccess("owner_or_admin"), true);
    assert.equal(isBoardReadAccess("guest"), false);
});

test("isBoardCreateAccess validates allowed values", () => {
    assert.equal(isBoardCreateAccess("auth"), true);
    assert.equal(isBoardCreateAccess("admin"), true);
    assert.equal(isBoardCreateAccess("public"), false);
});

test("isValidBoardSlug enforces slug pattern", () => {
    assert.equal(isValidBoardSlug("free"), true);
    assert.equal(isValidBoardSlug("dev-notice-1"), true);
    assert.equal(isValidBoardSlug("-free"), false);
    assert.equal(isValidBoardSlug("free-"), false);
    assert.equal(isValidBoardSlug("FREE"), false);
    assert.equal(isValidBoardSlug("a"), false);
});
