import assert from "node:assert/strict";
import test from "node:test";
import { parseLoginForm, parseRegisterForm } from "../../../schemas/auth.schema.js";

test("parseLoginForm trims username and keeps password", () => {
    const result = parseLoginForm({
        username: "  alice  ",
        password: " secret ",
        next: " /board ",
    });

    assert.equal(result.success, true);
    if (!result.success) return;

    assert.equal(result.data.username, "alice");
    assert.equal(result.data.password, " secret ");
    assert.equal(result.data.next, "/board");
});

test("parseLoginForm fails when required credentials are missing", () => {
    const result = parseLoginForm({
        username: "   ",
        password: "",
    });

    assert.equal(result.success, false);
});

test("parseRegisterForm normalizes username and password", () => {
    const result = parseRegisterForm({
        username: "  new-user ",
        password: "1234",
    });

    assert.equal(result.success, true);
    if (!result.success) return;

    assert.equal(result.data.username, "new-user");
    assert.equal(result.data.password, "1234");
});
