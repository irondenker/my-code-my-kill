import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

export async function withTestServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
    const { createApp } = await import("../../app.js");
    const app = createApp();
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Failed to bind test server");
    }

    const { port } = address as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        await run(baseUrl);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }
}

export function extractCsrfToken(html: string): string {
    const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
    if (!match?.[1]) {
        throw new Error("Failed to extract csrf token");
    }
    return match[1];
}

export function extractSessionCookie(response: Response): string | null {
    const headerBag = response.headers as Headers & { getSetCookie?: () => string[] };
    if (typeof headerBag.getSetCookie === "function") {
        const all = headerBag.getSetCookie();
        for (const rawCookie of all) {
            const pair = rawCookie.split(";")[0];
            if (pair?.startsWith("mcmk.sid=")) {
                return pair;
            }
        }
    }

    const raw = response.headers.get("set-cookie");
    if (!raw) {
        return null;
    }
    const match = raw.match(/mcmk\.sid=[^;]+/);
    return match?.[0] ?? null;
}

export async function fetchFormPage(params: {
    baseUrl: string;
    path: string;
    cookie?: string;
}): Promise<{ csrfToken: string; cookie: string; body: string }> {
    const requestInit = params.cookie ? { headers: { cookie: params.cookie } } : {};
    const response = await fetch(`${params.baseUrl}${params.path}`, requestInit);
    const body = await response.text();
    const csrfToken = extractCsrfToken(body);
    const cookie = extractSessionCookie(response) ?? params.cookie ?? "";
    if (!cookie) {
        throw new Error("Failed to resolve session cookie");
    }
    return { csrfToken, cookie, body };
}

export async function loginAs(params: {
    baseUrl: string;
    username: string;
    password: string;
    nextPath?: string;
}): Promise<string> {
    const nextPath = params.nextPath ?? "/board";
    const encodedNext = encodeURIComponent(nextPath);
    const loginPage = await fetchFormPage({
        baseUrl: params.baseUrl,
        path: `/login?next=${encodedNext}`,
    });

    const response = await fetch(`${params.baseUrl}/login`, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: loginPage.cookie,
        },
        body: `_csrf=${encodeURIComponent(loginPage.csrfToken)}&username=${encodeURIComponent(params.username)}&password=${encodeURIComponent(params.password)}&next=${encodedNext}`,
        redirect: "manual",
    });

    assert.equal(response.status, 302);
    return extractSessionCookie(response) ?? loginPage.cookie;
}

export async function withMutedAuditLogErrors(run: () => Promise<void>): Promise<void> {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("[AUDIT_LOG_ERROR]")) {
            return;
        }
        originalConsoleError(...args);
    };
    try {
        await run();
    } finally {
        console.error = originalConsoleError;
    }
}
