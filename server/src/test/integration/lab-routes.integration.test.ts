import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../helpers/subprocess-test.helpers.js";
import { SESSION_COOKIE_NAME } from "../../constants/session.constants.js";

const LAB_ROUTE_PROBE_SCRIPT = `
import fs from "node:fs";
import { once } from "node:events";

const mode = process.env.LAB_OPTIONS_MODE ?? "payload";
const payload = process.env.LAB_OPTIONS_PAYLOAD ?? "{}";
const originalReadFileSync = fs.readFileSync;
const SESSION_COOKIE_NAME = ${JSON.stringify(SESSION_COOKIE_NAME)};
const escapedCookieName = SESSION_COOKIE_NAME.split(".").join("\\\\.");
const sessionCookiePairRegex = new RegExp(escapedCookieName + "=[^;]+");

fs.readFileSync = function(targetPath, ...rest) {
    const pathname = String(targetPath);
    const isLabOptionsPath = pathname.endsWith("/lab-options.json") || pathname.endsWith("\\\\lab-options.json");
    if (!isLabOptionsPath) {
        return originalReadFileSync.call(fs, targetPath, ...rest);
    }

    if (mode === "missing") {
        const error = new Error("ENOENT");
        error.code = "ENOENT";
        throw error;
    }

    return payload;
};

process.env.NODE_ENV = process.env.NODE_ENV_OVERRIDE ?? process.env.NODE_ENV ?? "test";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.DB_NAME ??= "test_db";
process.env.DB_USER ??= "test_user";
process.env.DB_PASSWORD ??= "test_password";

const { createApp } = await import("./src/app.ts");
const app = createApp();
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
}

const method = process.env.REQUEST_METHOD ?? "GET";
const requestPath = process.env.REQUEST_PATH ?? "/";
const requestBody = process.env.REQUEST_BODY;
const baseUrl = "http://127.0.0.1:" + address.port;

const headers = {};
let response;
if (method === "POST") {
    headers["content-type"] = "application/x-www-form-urlencoded";

    const formPageResponse = await fetch(baseUrl + requestPath, { redirect: "manual" });
    const formPageHtml = await formPageResponse.text();
    const csrfMatch = formPageHtml.match(/name="_csrf"\\s+value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] ?? "";

    const headerBag = formPageResponse.headers;
    let cookie = "";
    if (typeof headerBag.getSetCookie === "function") {
        const all = headerBag.getSetCookie();
        for (const rawCookie of all) {
            const pair = rawCookie.split(";")[0];
            if (pair?.startsWith(SESSION_COOKIE_NAME + "=")) {
                cookie = pair;
                break;
            }
        }
    }
    if (!cookie) {
        const raw = formPageResponse.headers.get("set-cookie");
        const match = raw ? raw.match(sessionCookiePairRegex) : null;
        cookie = match?.[0] ?? "";
    }
    if (cookie) {
        headers.cookie = cookie;
    }

    const finalBody = (requestBody ?? "_csrf=__CSRF__").replace("__CSRF__", encodeURIComponent(csrfToken));
    response = await fetch(baseUrl + requestPath, {
        method,
        headers,
        body: finalBody,
        redirect: "manual",
    });
} else {
    response = await fetch(baseUrl + requestPath, {
        method,
        headers,
        body: requestBody || undefined,
        redirect: "manual",
    });
}
const text = await response.text();

await new Promise((resolve, reject) => {
    server.close((err) => {
        if (err) {
            reject(err);
            return;
        }
        resolve();
    });
});

console.log(JSON.stringify({
    status: response.status,
    location: response.headers.get("location"),
    csp: response.headers.get("content-security-policy"),
    cspReportOnly: response.headers.get("content-security-policy-report-only"),
    body: text,
}));
`;

async function probeLabRoute(params: {
    nodeEnv: string;
    options: Record<string, unknown>;
    path: string;
    method?: "GET" | "POST";
    body?: string;
}) {
    const { stdout } = await runTsxInlineScript({
        script: LAB_ROUTE_PROBE_SCRIPT,
        env: {
            NODE_ENV_OVERRIDE: params.nodeEnv,
            LAB_OPTIONS_MODE: "payload",
            LAB_OPTIONS_PAYLOAD: JSON.stringify(params.options),
            REQUEST_PATH: params.path,
            REQUEST_METHOD: params.method ?? "GET",
            ...(params.body ? { REQUEST_BODY: params.body } : {}),
        },
    });
    const lines = stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim().length > 0);
    const jsonLine = lines[lines.length - 1] ?? "{}";
    return JSON.parse(jsonLine) as {
        status: number;
        location: string | null;
        csp: string | null;
        cspReportOnly: string | null;
        body: string;
    };
}

test("occur route is blocked in production when debugErrorRoutes is disabled", async () => {
    const result = await probeLabRoute({
        nodeEnv: "production",
        options: {
            debug: { errorRoutes: { enabled: false } },
        },
        path: "/occur/ssr/500",
    });

    assert.equal(result.status, 404);
    assert.match(result.body, /data-error-code="404"/);
});

test("occur route is enabled in production when debugErrorRoutes is enabled", async () => {
    const result = await probeLabRoute({
        nodeEnv: "production",
        options: {
            debug: { errorRoutes: { enabled: true } },
        },
        path: "/occur/ssr/500",
    });

    assert.equal(result.status, 500);
    assert.match(result.body, /data-error-code="500"/);
});

test("ssti route shows disabled message when lab option is off", async () => {
    const result = await probeLabRoute({
        nodeEnv: "test",
        options: {
            ssti: { enabled: false },
        },
        path: "/labs/ssti",
    });

    assert.equal(result.status, 200);
    assert.match(result.body, /<form method="post" action="\/labs\/ssti"/);
    assert.match(result.body, /btn btn-danger" disabled/);
});

test("ssti route renders template output when lab option is on (with csrf lab mode)", async () => {
    const body = `_csrf=__CSRF__&title=${encodeURIComponent("hello")}&template=${encodeURIComponent("<%= title %>-<%= 7 * 7 %>")}`;
    const result = await probeLabRoute({
        nodeEnv: "test",
        options: {
            csrf: { enabled: true },
            ssti: { enabled: true },
        },
        path: "/labs/ssti",
        method: "POST",
        body,
    });

    assert.equal(result.status, 200);
    assert.match(result.body, /hello-49/);
});

test("csp header is emitted when csp lab option is enabled", async () => {
    const result = await probeLabRoute({
        nodeEnv: "test",
        options: {
            csp: { enabled: true },
        },
        path: "/healthz",
    });

    assert.equal(result.status, 200);
    assert.match(result.csp ?? "", /default-src 'self'/);
    assert.equal(result.cspReportOnly, null);
});

test("csp header is not emitted when csp lab option is disabled", async () => {
    const result = await probeLabRoute({
        nodeEnv: "test",
        options: {
            csp: { enabled: false },
        },
        path: "/healthz",
    });

    assert.equal(result.status, 200);
    assert.equal(result.csp, null);
    assert.equal(result.cspReportOnly, null);
});
