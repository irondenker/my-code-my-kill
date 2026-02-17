import assert from "node:assert/strict";
import test from "node:test";
import { summarizeErrorMessage } from "../../../../utils/http/error-summary.util.js";

test("summarizeErrorMessage compacts whitespace and includes error name", () => {
    const message = summarizeErrorMessage(new Error("line1 \n  line2"));
    assert.equal(message.startsWith("Error:"), true);
    assert.equal(message.includes("line1 line2"), true);
});

test("summarizeErrorMessage truncates with ellipsis and handles maxLength <= 0", () => {
    assert.equal(summarizeErrorMessage("abcdef", 4), "a...");
    assert.equal(summarizeErrorMessage("abcdef", 0), "");
});
