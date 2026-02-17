import assert from "node:assert/strict";
import test from "node:test";
import { withTestServer } from "../helpers/http-test.helpers.js";

function ensureTestEnv() {
    process.env.NODE_ENV ??= "test";
    process.env.SESSION_SECRET ??= "test-session-secret";
    process.env.DB_NAME ??= "test_db";
    process.env.DB_USER ??= "test_user";
    process.env.DB_PASSWORD ??= "test_password";
}

async function withMutedConsoleError(run: () => Promise<void>): Promise<void> {
    const originalConsoleError = console.error;
    console.error = () => {
        return;
    };
    try {
        await run();
    } finally {
        console.error = originalConsoleError;
    }
}

ensureTestEnv();

test("GET /healthz returns plain ok", async () => {
    await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/healthz`);
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.equal(body, "ok");
    });
});

test("GET /board/:slug/new redirects unauthenticated user to login with safe next", async () => {
    await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/board/free/new`, {
            redirect: "manual",
        });

        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), "/login?next=%2Fboard%2Ffree%2Fnew");
    });
});

test("GET /login includes hidden next field only for safe relative next path", async () => {
    await withTestServer(async (baseUrl) => {
        const safeResponse = await fetch(`${baseUrl}/login?next=%2Fboard%2Fnotice`);
        const safeBody = await safeResponse.text();

        assert.equal(safeResponse.status, 200);
        assert.match(safeBody, /name="next" value="\/board\/notice"/);

        const unsafeResponse = await fetch(`${baseUrl}/login?next=https://evil.example`);
        const unsafeBody = await unsafeResponse.text();

        assert.equal(unsafeResponse.status, 200);
        assert.equal(unsafeBody.includes('name="next"'), false);
    });
});

test("POST /login without csrf token is blocked with 403 common error page", async () => {
    await withMutedConsoleError(async () => {
        await withTestServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/login`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
                body: "username=alice&password=secret1234",
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 403);
            assert.match(body, /data-error-code="403"/);
            assert.match(body, /data-error-source="app"/);
        });
    });
});

test("unknown route returns 404 common error page", async () => {
    await withMutedConsoleError(async () => {
        await withTestServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/not-found-route`);
            const body = await response.text();

            assert.equal(response.status, 404);
            assert.match(body, /data-error-code="404"/);
            assert.match(body, /data-error-source="app"/);
        });
    });
});
