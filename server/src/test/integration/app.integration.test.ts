import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
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

test("GET / renders landing page from root controller", async () => {
    await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/`);
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.match(body, /aria-label="Landing Cover"/);
        assert.match(body, /xlink:href="\/assets\/icons\/logo\.svg#logo"/);
    });
});

test("static middleware sets nosniff and attachment disposition for uploaded files", async () => {
    const filename = `test-attachment-${Date.now().toString(36)}.txt`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "posts", "files");
    const filePath = path.join(uploadDir, filename);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, "attachment-test", "utf8");

    try {
        await withTestServer(async (baseUrl) => {
            const cssResponse = await fetch(`${baseUrl}/assets/css/color-modes.css`);
            assert.equal(cssResponse.status, 200);
            assert.equal(cssResponse.headers.get("x-content-type-options"), "nosniff");

            const fileResponse = await fetch(`${baseUrl}/uploads/posts/files/${filename}`);
            assert.equal(fileResponse.status, 200);
            assert.equal(fileResponse.headers.get("x-content-type-options"), "nosniff");

            const contentDisposition = fileResponse.headers.get("content-disposition") ?? "";
            assert.match(contentDisposition, /attachment;/);
            assert.match(contentDisposition, new RegExp(`filename=\"${filename}\"`));
        });
    } finally {
        await fs.unlink(filePath).catch(() => undefined);
    }
});

test("session middleware sets HttpOnly and SameSite cookie on csrf-backed page", async () => {
    await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/login`);
        const rawCookie = response.headers.get("set-cookie") ?? "";

        assert.equal(response.status, 200);
        assert.match(rawCookie, /mcmk\.sid=/);
        assert.match(rawCookie, /HttpOnly/i);
        assert.match(rawCookie, /SameSite=Lax/i);
    });
});

test("GET /api-docs returns swagger ui shell with inlined spec payload", async () => {
    await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api-docs`);
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
        assert.match(body, /SwaggerUIBundle/);
        assert.match(body, /const spec = /);
        assert.match(body, /openapi/);
    });
});

test("GET /labs renders lab index page with ssti entry", async () => {
    await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/labs`);
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.match(body, /<main class="container py-4 board-page">/);
        assert.match(body, /href="\/labs\/ssti"/);
        assert.match(body, /badge text-bg-(success|secondary)/);
    });
});

test("GET /@@username is rejected as invalid public profile handle", async () => {
    await withMutedConsoleError(async () => {
        await withTestServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/@@invalid-handle`);
            const body = await response.text();

            assert.equal(response.status, 400);
            assert.match(body, /data-error-code="400"/);
        });
    });
});
