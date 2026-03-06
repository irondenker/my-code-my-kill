import assert from "node:assert/strict";
import test from "node:test";
import {
    computeTotalPages,
    normalizeLimitByOptions,
    parsePositiveInt,
} from "../../../utils/pagination.util.js";

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

test("parsePositiveInt normalizes invalid values to fallback", () => {
    assert.equal(parsePositiveInt("3", 1), 3);
    assert.equal(parsePositiveInt("1.9", 7), 7);
    assert.equal(parsePositiveInt(0, 7), 7);
    assert.equal(parsePositiveInt("abc", 7), 7);
});

test("normalizeLimitByOptions accepts allowed options and normalizes out-of-range", () => {
    const allowed = [10, 20, 30, 40, 50, 100] as const;

    assert.equal(
        normalizeLimitByOptions({
            rawValue: "20",
            defaultLimit: 10,
            maxLimit: 100,
            allowedOptions: allowed,
        }),
        20
    );

    assert.equal(
        normalizeLimitByOptions({
            rawValue: "9999",
            defaultLimit: 10,
            maxLimit: 100,
            allowedOptions: allowed,
        }),
        100
    );

    assert.equal(
        normalizeLimitByOptions({
            rawValue: "35",
            defaultLimit: 10,
            maxLimit: 100,
            allowedOptions: allowed,
        }),
        10
    );

    assert.equal(
        normalizeLimitByOptions({
            rawValue: "abc",
            defaultLimit: 10,
            maxLimit: 100,
            allowedOptions: allowed,
        }),
        10
    );
});
