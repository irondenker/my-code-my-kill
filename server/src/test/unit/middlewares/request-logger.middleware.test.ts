import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequestLogger } from "../../../middlewares/request-logger.middleware.js";

class MockResponse extends EventEmitter {
    statusCode = 200;
    writableEnded = false;
    private contentLength: string | number | undefined;

    setContentLength(value: string | number | undefined) {
        this.contentLength = value;
    }

    getHeader(name: string): string | number | undefined {
        if (name.toLowerCase() === "content-length") {
            return this.contentLength;
        }
        return undefined;
    }
}

function makeRequest(overrides: Partial<any> = {}) {
    return {
        method: "GET",
        path: "/board",
        originalUrl: "/board?page=1",
        ip: "127.0.0.1",
        session: {},
        get(name: string) {
            if (name.toLowerCase() === "user-agent") {
                return "test-agent";
            }
            return undefined;
        },
        ...overrides,
    };
}

test("request logger skips default ignored paths", () => {
    const logger = createRequestLogger();
    const req = makeRequest({ path: "/healthz", originalUrl: "/healthz" });
    const res = new MockResponse();

    const logs: string[] = [];
    const originalInfo = console.info;
    console.info = (message?: unknown) => {
        logs.push(String(message ?? ""));
    };

    try {
        let nextCalled = false;
        logger(req as any, res as any, () => {
            nextCalled = true;
        });
        assert.equal(nextCalled, true);

        res.emit("finish");
        assert.equal(logs.length, 0);
    } finally {
        console.info = originalInfo;
    }
});

test("request logger writes finish log with request context", () => {
    const logger = createRequestLogger();
    const req = makeRequest({
        method: "POST",
        path: "/board/free",
        originalUrl: "/board/free",
        session: { userId: 7 },
    });
    const res = new MockResponse();
    res.statusCode = 201;
    res.setContentLength(128);

    const logs: string[] = [];
    const originalInfo = console.info;
    console.info = (message?: unknown) => {
        logs.push(String(message ?? ""));
    };

    try {
        logger(req as any, res as any, () => undefined);
        res.emit("finish");

        assert.equal(logs.length, 1);
        assert.match(logs[0] ?? "", /\[ACCESS\] POST \/board\/free/);
        assert.match(logs[0] ?? "", /status=201/);
        assert.match(logs[0] ?? "", /bytes=128/);
        assert.match(logs[0] ?? "", /userId=7/);
        assert.match(logs[0] ?? "", /result=finish/);
    } finally {
        console.info = originalInfo;
    }
});

test("request logger writes close log only when response not ended", () => {
    const logger = createRequestLogger();
    const req = makeRequest({ originalUrl: "/board/close" });
    const res = new MockResponse();

    const logs: string[] = [];
    const originalInfo = console.info;
    console.info = (message?: unknown) => {
        logs.push(String(message ?? ""));
    };

    try {
        logger(req as any, res as any, () => undefined);

        res.writableEnded = false;
        res.emit("close");
        assert.equal(logs.length, 1);
        assert.match(logs[0] ?? "", /result=close/);

        res.writableEnded = true;
        res.emit("close");
        assert.equal(logs.length, 1);
    } finally {
        console.info = originalInfo;
    }
});
