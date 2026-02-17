import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

const SQLI_CONTROL_PROBE_SCRIPT = `
import fs from "node:fs";

const payload = process.env.LAB_OPTIONS_PAYLOAD ?? "{}";
const originalReadFileSync = fs.readFileSync;

fs.readFileSync = function(targetPath, ...rest) {
    const pathname = String(targetPath);
    const isLabOptionsPath = pathname.endsWith("/lab-options.json") || pathname.endsWith("\\\\lab-options.json");
    if (!isLabOptionsPath) {
        return originalReadFileSync.call(fs, targetPath, ...rest);
    }
    return payload;
};

const { isSqlInjectionTargetEnabled } = await import("./src/services/lab/sql-injection-control.service.ts");
const target = process.env.SQLI_TARGET ?? "usernameLookup";
const enabled = isSqlInjectionTargetEnabled(target);
console.log(JSON.stringify({ enabled }));
`;

async function probeSqliTargetEnabled(payload: Record<string, unknown>): Promise<boolean> {
    const { stdout } = await runTsxInlineScript({
        script: SQLI_CONTROL_PROBE_SCRIPT,
        env: {
            SQLI_TARGET: "usernameLookup",
            LAB_OPTIONS_PAYLOAD: JSON.stringify(payload),
        },
    });
    const result = JSON.parse(stdout.trim()) as { enabled: boolean };
    return result.enabled;
}

test("isSqlInjectionTargetEnabled returns false when global sqlInjection is disabled", async () => {
    const enabled = await probeSqliTargetEnabled({
        sqlInjection: {
            enabled: false,
            targets: {
                usernameLookup: true,
            },
        },
    });

    assert.equal(enabled, false);
});

test("isSqlInjectionTargetEnabled returns true when global and target toggles are enabled", async () => {
    const enabled = await probeSqliTargetEnabled({
        sqlInjection: {
            enabled: true,
            targets: {
                usernameLookup: true,
            },
        },
    });

    assert.equal(enabled, true);
});

test("isSqlInjectionTargetEnabled returns false when target toggle is disabled", async () => {
    const enabled = await probeSqliTargetEnabled({
        sqlInjection: {
            enabled: true,
            targets: {
                usernameLookup: false,
            },
        },
    });

    assert.equal(enabled, false);
});
