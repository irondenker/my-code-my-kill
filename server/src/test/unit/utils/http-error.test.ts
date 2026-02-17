import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../../../utils/http-error.js";

test("HttpError carries status and message and preserves Error prototype", () => {
    const error = new HttpError(403, "Forbidden");

    assert.equal(error.status, 403);
    assert.equal(error.message, "Forbidden");
    assert.equal(error instanceof Error, true);
    assert.equal(error instanceof HttpError, true);
    assert.equal(error.name, "Error");
});
