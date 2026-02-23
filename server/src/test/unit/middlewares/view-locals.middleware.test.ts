import assert from "node:assert/strict";
import test from "node:test";
import type { LabOptions } from "../../../config/lab-options.js";
import { createViewLocalsMiddleware } from "../../../middlewares/view-locals.middleware.js";

function makeLabOptions(): LabOptions {
    return {
        sqlInjection: {
            enabled: false,
            targets: {
                authLookup: false,
                authCreate: false,
                profileLookup: false,
                profileUpdate: false,
                boardLookup: false,
                boardCreate: false,
                boardUpdate: false,
                articleLookup: false,
                articleCreate: false,
                articleUpdate: false,
                articleDelete: false,
            },
        },
        ssti: false,
        debugErrorRoutes: false,
        csrf: { enabled: false },
        xssInjection: {
            storedXss: true,
            clientSide: {
                sanitizeEnabled: false,
                defaultRuleToggles: {
                    ampersand: true,
                    lessThan: true,
                    greaterThan: true,
                    doubleQuote: true,
                    singleQuote: true,
                    backtick: true,
                },
                customRules: [{ from: "<x>", to: "&lt;x&gt;" }],
            },
            serverSide: {
                sanitizeEnabled: true,
                defaultRuleToggles: {
                    ampersand: true,
                    lessThan: true,
                    greaterThan: true,
                    doubleQuote: true,
                    singleQuote: true,
                    backtick: true,
                },
                customRules: [],
            },
        },
        uploadValidation: {
            extensionCheck: true,
            mimeCheck: true,
            magicNumberCheck: true,
        },
        securityDefense: {},
    };
}

function makeRes() {
    return { locals: {} as Record<string, unknown> };
}

test("createViewLocalsMiddleware populates csrf/session/xss locals", () => {
    const middleware = createViewLocalsMiddleware({
        labOptions: makeLabOptions(),
        escapeForXss: (value) => String(value).replace(/</g, "&lt;"),
    });
    const req = {
        csrfToken: () => "csrf-token-123",
        session: {
            userId: 7,
            username: "alice",
            userRole: "admin",
            profileImageUrl: "avatar.png",
        },
    };
    const res = makeRes();
    let nextCalled = false;

    middleware(req as any, res as any, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.locals.csrfToken, "csrf-token-123");
    assert.equal(res.locals.sessionUser, 7);
    assert.equal(res.locals.sessionUsername, "alice");
    assert.equal(res.locals.sessionUserRole, "admin");
    assert.equal(res.locals.labStoredXssEnabled, true);
    assert.equal(res.locals.clientSideSanitizeEnabled, false);
    assert.equal(res.locals.serverSideSanitizeEnabled, true);
    assert.equal(res.locals.sessionProfileImageUrl, "/uploads/avatars/avatar.png");
    assert.equal(typeof res.locals.escapeForXss, "function");
});

test("createViewLocalsMiddleware handles missing csrf and absolute profile url", () => {
    const middleware = createViewLocalsMiddleware({
        labOptions: makeLabOptions(),
        escapeForXss: (value) => String(value),
    });
    const req = {
        session: {
            profileImageUrl: "/uploads/avatars/keep-me.png",
        },
    };
    const res = makeRes();

    middleware(req as any, res as any, () => undefined);

    assert.equal(res.locals.csrfToken, null);
    assert.equal(res.locals.sessionUser, null);
    assert.equal(res.locals.sessionUsername, null);
    assert.equal(res.locals.sessionUserRole, null);
    assert.equal(res.locals.sessionProfileImageUrl, "/uploads/avatars/keep-me.png");
});
