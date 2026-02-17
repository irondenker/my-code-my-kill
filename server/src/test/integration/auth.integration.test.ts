import assert from "node:assert/strict";
import test from "node:test";
import { fetchFormPage, withMutedAuditLogErrors, withTestServer } from "../helpers/http-test.helpers.js";

function ensureTestEnv() {
    process.env.NODE_ENV ??= "test";
    process.env.SESSION_SECRET ??= "test-session-secret";
    process.env.DB_NAME ??= "test_db";
    process.env.DB_USER ??= "test_user";
    process.env.DB_PASSWORD ??= "test_password";
}

ensureTestEnv();

test("POST /login with missing credentials returns 400 with form error (csrf valid)", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/login" });

            const response = await fetch(`${baseUrl}/login`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=&password=&next=%2Fboard`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 400);
            assert.match(body, /alert alert-danger/);
            assert.match(body, /name="next" value="\/board"/);
        });
    });
});

test("POST /register with invalid username returns 422 before DB lookup", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/register" });

            const response = await fetch(`${baseUrl}/register`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=ab&password=12345678`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 422);
            assert.match(body, /alert alert-danger/);
        });
    });
});

test("POST /register with invalid password returns 422 before DB lookup", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/register" });

            const response = await fetch(`${baseUrl}/register`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=alice&password=1234`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 422);
            assert.match(body, /alert alert-danger/);
        });
    });
});

test("POST /register with missing username returns 400", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/register" });

            const response = await fetch(`${baseUrl}/register`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=&password=valid-pass-123`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 400);
            assert.match(body, /Username is required\./);
        });
    });
});

test("POST /register with missing password returns 400", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/register" });

            const response = await fetch(`${baseUrl}/register`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=valid-user&password=`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 400);
            assert.match(body, /Password is required\./);
        });
    });
});

test("POST /login missing credentials with unsafe next does not render next hidden field", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/login" });

            const response = await fetch(`${baseUrl}/login`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=&password=&next=${encodeURIComponent("https://evil.example")}`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 400);
            assert.equal(body.includes('name="next"'), false);
        });
    });
});

test("POST /logout while unauthenticated still destroys session and redirects to root", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/login" });
            const response = await fetch(`${baseUrl}/logout`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}`,
                redirect: "manual",
            });

            assert.equal(response.status, 302);
            assert.equal(response.headers.get("location"), "/");
            assert.match(response.headers.get("set-cookie") ?? "", /mcmk\.sid=/);
        });
    });
});
