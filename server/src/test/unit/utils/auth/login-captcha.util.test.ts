import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
    clearLoginCaptchaState,
    recordLoginFailureForCaptcha,
    resolveLoginCaptchaViewModel,
    verifyLoginCaptchaAnswer,
} from "../../../../utils/auth/login-captcha.util.js";

function createRequestWithSession(): Request {
    return {
        session: {},
    } as Request;
}

test("login captcha remains disabled when toggle is off", () => {
    const req = createRequestWithSession();
    recordLoginFailureForCaptcha(req, {
        enabled: false,
        afterFailures: 1,
    });

    const viewModel = resolveLoginCaptchaViewModel(req, false);
    assert.equal(viewModel.required, false);
    assert.equal(viewModel.question, null);
});

test("login captcha is required after threshold failures", () => {
    const req = createRequestWithSession();
    recordLoginFailureForCaptcha(req, {
        enabled: true,
        afterFailures: 2,
    });
    recordLoginFailureForCaptcha(req, {
        enabled: true,
        afterFailures: 2,
    });

    const viewModel = resolveLoginCaptchaViewModel(req, true);
    assert.equal(viewModel.required, true);
    assert.equal(typeof viewModel.question, "string");
    assert.equal((viewModel.question ?? "").length > 0, true);
});

test("login captcha verify returns false on wrong answer and true on correct answer", () => {
    const req = createRequestWithSession();
    recordLoginFailureForCaptcha(req, {
        enabled: true,
        afterFailures: 1,
    });

    const viewModel = resolveLoginCaptchaViewModel(req, true);
    assert.equal(viewModel.required, true);

    const wrong = verifyLoginCaptchaAnswer(req, "not-correct");
    assert.equal(wrong, false);

    const expectedAnswer = req.session.loginCaptchaAnswer;
    assert.equal(typeof expectedAnswer, "string");
    const correct = verifyLoginCaptchaAnswer(req, expectedAnswer ?? "");
    assert.equal(correct, true);

    clearLoginCaptchaState(req);
    const resetViewModel = resolveLoginCaptchaViewModel(req, true);
    assert.equal(resetViewModel.required, false);
});
