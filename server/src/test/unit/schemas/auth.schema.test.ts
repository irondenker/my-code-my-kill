import assert from "node:assert/strict";
import test from "node:test";
import {
    parseForgotPasswordForm,
    parseLoginForm,
    parseRegisterForm,
    parseResetPasswordForm,
} from "../../../schemas/auth.schema.js";

test("parseLoginForm trims username and keeps password", () => {
    const result = parseLoginForm({
        username: "  alice  ",
        password: " secret ",
        captchaAnswer: " 12 ",
        next: " /board ",
    });

    assert.equal(result.success, true);
    if (!result.success) return;

    assert.equal(result.data.username, "alice");
    assert.equal(result.data.password, " secret ");
    assert.equal(result.data.captchaAnswer, "12");
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

test("parseForgotPasswordForm trims optional verification fields", () => {
    const result = parseForgotPasswordForm({
        username: "  alice ",
        email: "  alice@example.com ",
        phoneNumber: " 010-1111-2222 ",
    });

    assert.equal(result.success, true);
    if (!result.success) return;

    assert.equal(result.data.username, "alice");
    assert.equal(result.data.email, "alice@example.com");
    assert.equal(result.data.phoneNumber, "010-1111-2222");
});

test("parseResetPasswordForm requires token/password/confirmPassword", () => {
    const invalid = parseResetPasswordForm({
        token: " ",
        password: "",
        confirmPassword: "",
    });
    assert.equal(invalid.success, false);

    const valid = parseResetPasswordForm({
        token: " token-123 ",
        password: "new-password-123",
        confirmPassword: "new-password-123",
    });
    assert.equal(valid.success, true);
    if (!valid.success) return;

    assert.equal(valid.data.token, "token-123");
});
