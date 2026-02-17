import assert from "node:assert/strict";
import test from "node:test";
import { getRequestIp, getRequestUserAgent } from "../../../utils/request-meta.util.js";

test("getRequestIp trims string and returns null for empty values", () => {
    assert.equal(getRequestIp({ ip: " 127.0.0.1 " } as any), "127.0.0.1");
    assert.equal(getRequestIp({ ip: "  " } as any), null);
});

test("getRequestUserAgent trims header and returns null for missing/empty", () => {
    assert.equal(
        getRequestUserAgent({
            get(name: string) {
                return name === "user-agent" ? "  UA  " : undefined;
            },
        } as any),
        "UA"
    );

    assert.equal(
        getRequestUserAgent({
            get() {
                return " ";
            },
        } as any),
        null
    );
});
