import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../../../../utils/http/http-error.js";
import { getPositiveIntParamOrThrow, getStringParamOrThrow } from "../../../../utils/http/route-param.util.js";

test("getStringParamOrThrow trims and returns route param", () => {
    const req = { params: { slug: " free " } };
    assert.equal(getStringParamOrThrow(req as any, "slug"), "free");
});

test("getStringParamOrThrow throws HttpError(404) for missing/empty param", () => {
    const req = { params: { slug: "   " } };
    assert.throws(() => getStringParamOrThrow(req as any, "slug"), (err: unknown) => {
        assert.equal(err instanceof HttpError, true);
        assert.equal((err as HttpError).status, 404);
        return true;
    });
});

test("getPositiveIntParamOrThrow parses positive number and truncates decimals", () => {
    const req = { params: { displayId: "42.9" } };
    assert.equal(getPositiveIntParamOrThrow(req as any, "displayId"), 42);
});

test("getPositiveIntParamOrThrow throws HttpError(404) for invalid numbers", () => {
    const req = { params: { displayId: "0" } };
    assert.throws(() => getPositiveIntParamOrThrow(req as any, "displayId"), (err: unknown) => {
        assert.equal(err instanceof HttpError, true);
        assert.equal((err as HttpError).status, 404);
        return true;
    });
});
