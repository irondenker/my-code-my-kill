import assert from "node:assert/strict";
import test from "node:test";
import { computeTotalPages } from "../../../utils/pagination.util.js";

test("computeTotalPages keeps minimum one page", () => {
    assert.equal(computeTotalPages(0, 20), 1);
    assert.equal(computeTotalPages(1, 20), 1);
});

test("computeTotalPages normalizes limit and computes ceil pages", () => {
    assert.equal(computeTotalPages(21, 20), 2);
    assert.equal(computeTotalPages(40, 20), 2);
    assert.equal(computeTotalPages(41, 20), 3);
    assert.equal(computeTotalPages(10, 0), 10);
});
