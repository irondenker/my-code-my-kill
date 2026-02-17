import assert from "node:assert/strict";
import test from "node:test";
import { createGlobalCsrfMiddlewares } from "../../../middlewares/csrf.middleware.js";

test("createGlobalCsrfMiddlewares returns empty array when csrf lab is enabled", () => {
    const middlewares = createGlobalCsrfMiddlewares({ csrfLabEnabled: true });
    assert.equal(Array.isArray(middlewares), true);
    assert.equal(middlewares.length, 0);
});

test("createGlobalCsrfMiddlewares returns pre-parser and csrf middleware when disabled", () => {
    const middlewares = createGlobalCsrfMiddlewares({ csrfLabEnabled: false });
    assert.equal(middlewares.length, 2);
    assert.equal(typeof middlewares[0], "function");
    assert.equal(typeof middlewares[1], "function");
});

test("multipart pre-parser bypasses non-POST requests", () => {
    const [preParser] = createGlobalCsrfMiddlewares({ csrfLabEnabled: false });
    assert.ok(preParser);

    let nextCalled = false;
    preParser!(
        {
            method: "GET",
            path: "/users/avatar",
            session: {},
        } as any,
        {} as any,
        () => {
            nextCalled = true;
        }
    );

    assert.equal(nextCalled, true);
});

test("multipart pre-parser bypasses unauthenticated POST to avatar path", () => {
    const [preParser] = createGlobalCsrfMiddlewares({ csrfLabEnabled: false });
    assert.ok(preParser);

    let nextCalled = false;
    preParser!(
        {
            method: "POST",
            path: "/users/avatar",
            session: {},
        } as any,
        {} as any,
        () => {
            nextCalled = true;
        }
    );

    assert.equal(nextCalled, true);
});
