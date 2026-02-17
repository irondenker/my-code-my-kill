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

const protectedGetPaths = [
    "/board/free/new",
    "/board/free/1/edit",
    "/settings/profile",
    "/admin",
    "/admin/users",
    "/admin/boards",
    "/admin/boards/1/edit",
    "/admin/audit-logs",
] as const;

const protectedPostPaths = [
    "/board/free",
    "/board/free/1/edit",
    "/board/free/1/delete",
    "/settings/profile",
    "/users/avatar/delete",
    "/admin/users/1/status",
    "/admin/users/1/role",
    "/admin/boards",
    "/admin/boards/1/edit",
] as const;

test("unauthenticated GET on protected routes always redirects to login with safe next", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            for (const path of protectedGetPaths) {
                const response = await fetch(`${baseUrl}${path}`, {
                    redirect: "manual",
                });

                assert.equal(response.status, 302, `GET ${path} should redirect`);
                assert.equal(response.headers.get("location"), `/login?next=${encodeURIComponent(path)}`);
            }
        });
    });
});

test("unauthenticated POST on protected routes redirects to login when csrf token is valid", async () => {
    await withMutedAuditLogErrors(async () => {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({
                baseUrl,
                path: "/login",
            });

            for (const path of protectedPostPaths) {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                        cookie,
                    },
                    body: `_csrf=${encodeURIComponent(csrfToken)}`,
                    redirect: "manual",
                });

                assert.equal(response.status, 302, `POST ${path} should redirect`);
                assert.equal(response.headers.get("location"), `/login?next=${encodeURIComponent(path)}`);
            }
        });
    });
});

test("requireAuth-protected DELETE route redirects to login with next path", async () => {
    await withTestServer(async (baseUrl) => {
        const { csrfToken, cookie } = await fetchFormPage({
            baseUrl,
            path: "/login",
        });
        const path = "/board/free/1";
        const response = await fetch(`${baseUrl}${path}`, {
            method: "DELETE",
            headers: {
                cookie,
                "csrf-token": csrfToken,
            },
            redirect: "manual",
        });

        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), `/login?next=${encodeURIComponent(path)}`);
    });
});
