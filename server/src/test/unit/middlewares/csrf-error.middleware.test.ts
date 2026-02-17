import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV ??= "test";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.DB_NAME ??= "test_db";
process.env.DB_USER ??= "test_user";
process.env.DB_PASSWORD ??= "test_password";

import { HttpError } from "../../../utils/http/http-error.js";

const { createCsrfErrorMiddleware } = await import("../../../middlewares/csrf-error.middleware.js");

function makeReq(overrides: Partial<any> = {}) {
    return {
        session: {
            userId: 42,
            username: "alice",
        },
        method: "POST",
        originalUrl: "/login",
        ip: "127.0.0.1",
        get(name: string) {
            if (name.toLowerCase() === "user-agent") {
                return "csrf-test-agent";
            }
            return undefined;
        },
        ...overrides,
    };
}

function makeRes() {
    return {
        locals: {} as Record<string, unknown>,
    };
}

test("csrfErrorMiddleware passes through non-csrf errors", () => {
    const middleware = createCsrfErrorMiddleware();
    const req = makeReq();
    const res = makeRes();
    const inputError = new Error("boom");

    let forwarded: unknown = null;
    middleware(inputError, req as any, res as any, (err?: unknown) => {
        forwarded = err;
    });

    assert.equal(forwarded, inputError);
    assert.equal(res.locals.securityEventLogged, undefined);
});

test("csrfErrorMiddleware logs csrf event and forwards HttpError(403)", () => {
    const captured: Array<Record<string, unknown>> = [];
    const middleware = createCsrfErrorMiddleware({
        logCsrfInvalid(params) {
            captured.push(params as Record<string, unknown>);
        },
    });
    const req = makeReq();
    const res = makeRes();

    let forwarded: unknown = null;
    middleware({ code: "EBADCSRFTOKEN" }, req as any, res as any, (err?: unknown) => {
        forwarded = err;
    });

    assert.equal(captured.length, 1);
    assert.deepEqual(captured[0], {
        actorUserId: 42,
        actorUsername: "alice",
        method: "POST",
        path: "/login",
        ipAddress: "127.0.0.1",
        userAgent: "csrf-test-agent",
    });
    assert.equal(res.locals.securityEventLogged, true);
    assert.equal(forwarded instanceof HttpError, true);
    assert.equal((forwarded as HttpError).status, 403);
    assert.equal((forwarded as HttpError).message, "Invalid CSRF token");
});
