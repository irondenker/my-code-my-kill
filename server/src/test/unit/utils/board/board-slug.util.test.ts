import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBoardSlug } from "../../../../utils/board/board-slug.util.js";

test("normalizeBoardSlug maps known legacy aliases to canonical slugs", () => {
    assert.equal(normalizeBoardSlug("useronly"), "user-only");
    assert.equal(normalizeBoardSlug("USERONLY"), "user-only");
    assert.equal(normalizeBoardSlug(" useronly "), "user-only");
});

test("normalizeBoardSlug keeps canonical or unrelated slugs unchanged", () => {
    assert.equal(normalizeBoardSlug("user-only"), "user-only");
    assert.equal(normalizeBoardSlug("general"), "general");
    assert.equal(normalizeBoardSlug("qna"), "qna");
});

