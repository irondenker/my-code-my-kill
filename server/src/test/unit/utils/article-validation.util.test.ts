import assert from "node:assert/strict";
import test from "node:test";
import { isValidArticleContent, isValidArticleTitle } from "../../../utils/article-validation.util.js";

test("isValidArticleTitle enforces 2~255 chars", () => {
    assert.equal(isValidArticleTitle("a"), false);
    assert.equal(isValidArticleTitle("ok"), true);
    assert.equal(isValidArticleTitle("x".repeat(255)), true);
    assert.equal(isValidArticleTitle("x".repeat(256)), false);
});

test("isValidArticleContent enforces 2~10000 chars", () => {
    assert.equal(isValidArticleContent("a"), false);
    assert.equal(isValidArticleContent("ok"), true);
    assert.equal(isValidArticleContent("x".repeat(10000)), true);
    assert.equal(isValidArticleContent("x".repeat(10001)), false);
});
