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
            assert.match(body, /Username and password are required\./);
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
            assert.match(body, /Username must be 3-50 characters\./);
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
            assert.match(body, /Password must be at least 8 characters\./);
        });
    });
});
