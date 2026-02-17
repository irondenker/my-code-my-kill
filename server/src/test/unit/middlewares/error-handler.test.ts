import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.NODE_ENV ??= "test";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.DB_NAME ??= "test_db";
process.env.DB_USER ??= "test_user";
process.env.DB_PASSWORD ??= "test_password";

const { errorHandler } = await import("../../../middlewares/error-handler.js");

type MockReq = {
    session: {
        userId?: number;
        username?: string;
    };
    originalUrl: string;
    path: string;
    method: string;
    ip: string;
    get: (name: string) => string | undefined;
};

type MockRes = {
    locals: Record<string, unknown>;
    statusCode?: number;
    contentType?: string;
    sentBody?: string;
    redirectLocation?: string;
    status: (code: number) => MockRes;
    type: (contentType: string) => MockRes;
    send: (body: string) => MockRes;
    redirect: (location: string) => MockRes;
};

const originalConsoleError = console.error;

before(() => {
    console.error = () => undefined;
});

after(() => {
    console.error = originalConsoleError;
});

function makeReq(overrides: Partial<MockReq> = {}): MockReq {
    return {
        session: {},
        originalUrl: "/board/free",
        path: "/board/free",
        method: "GET",
        ip: "127.0.0.1",
        get(name: string) {
            if (name.toLowerCase() === "user-agent") {
                return "test-agent";
            }
            return undefined;
        },
        ...overrides,
    };
}

function makeRes(): MockRes {
    const res: MockRes = {
        locals: {},
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        type(contentType: string) {
            res.contentType = contentType;
            return res;
        },
        send(body: string) {
            res.sentBody = body;
            return res;
        },
        redirect(location: string) {
            res.redirectLocation = location;
            return res;
        },
    };
    return res;
}

test("errorHandler redirects 401 errors to login with safe next", () => {
    const req = makeReq({
        originalUrl: "/board/free?page=2",
        path: "/board/free",
    });
    const res = makeRes();

    errorHandler({ status: 401 }, req as any, res as any, () => undefined);

    assert.equal(res.redirectLocation, "/login?next=%2Fboard%2Ffree%3Fpage%3D2");
});

test("errorHandler redirects 401 on login path to plain /login", () => {
    const req = makeReq({
        originalUrl: "/login?next=%2Fboard",
        path: "/login",
    });
    const res = makeRes();

    errorHandler({ status: 401 }, req as any, res as any, () => undefined);

    assert.equal(res.redirectLocation, "/login");
});

test("errorHandler renders static app source page for 404", () => {
    const req = makeReq();
    const res = makeRes();

    errorHandler({ status: 404 }, req as any, res as any, () => undefined);

    assert.equal(res.statusCode, 404);
    assert.equal(res.contentType, "html");
    assert.match(res.sentBody ?? "", /data-error-code="404"/);
    assert.match(res.sentBody ?? "", /data-error-source="app"/);
});

test("errorHandler renders fallback source for non-static status", () => {
    const req = makeReq();
    const res = makeRes();

    errorHandler({ status: 418 }, req as any, res as any, () => undefined);

    assert.equal(res.statusCode, 418);
    assert.match(res.sentBody ?? "", /data-error-code="418"/);
    assert.match(res.sentBody ?? "", /data-error-source="app-fallback"/);
});

test("errorHandler marks securityEventLogged for 403 when not already set", () => {
    const req = makeReq();
    const res = makeRes();
    res.locals.securityEventLogged = false;

    errorHandler({ status: 403, message: "Forbidden" }, req as any, res as any, () => undefined);

    assert.equal(res.locals.securityEventLogged, true);
    assert.equal(res.statusCode, 403);
    assert.match(res.sentBody ?? "", /data-error-source="app"/);
});
