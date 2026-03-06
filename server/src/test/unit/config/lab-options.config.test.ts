import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

const LAB_OPTIONS_PROBE_SCRIPT = `
import fs from "node:fs";

const mode = process.env.LAB_OPTIONS_MODE ?? "missing";
const payload = process.env.LAB_OPTIONS_PAYLOAD ?? "";
const originalReadFileSync = fs.readFileSync;

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
    if (mode === "invalid-json") {
        return "{";
    }
    return payload;
};

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => {
    warnings.push(args.map((arg) => String(arg)).join(" "));
};

const { getLabOptions } = await import("./src/config/lab-options.ts");
const options = getLabOptions();
console.warn = originalWarn;

console.log(JSON.stringify({ options, warnings }));
`;

async function readLabOptionsViaSubprocess(env: Record<string, string>) {
    const { stdout } = await runTsxInlineScript({
        script: LAB_OPTIONS_PROBE_SCRIPT,
        env,
    });
    return JSON.parse(stdout.trim()) as {
        options: any;
        warnings: string[];
    };
}

test("lab-options loader falls back to defaults when file is missing", async () => {
    const result = await readLabOptionsViaSubprocess({
        LAB_OPTIONS_MODE: "missing",
    });

    assert.equal(result.options.sqlInjection.enabled, false);
    assert.equal(result.options.csrf.enabled, false);
    assert.equal(result.options.csp.enabled, true);
    assert.equal(result.options.ssti, false);
    assert.equal(result.options.debugErrorRoutes, false);
    assert.equal(result.options.xssInjection.reflected404, false);
    assert.equal(typeof result.options.uploadValidation.extensionCheck, "boolean");
    assert.equal(typeof result.options.uploadValidation.mimeCheck, "boolean");
    assert.equal(typeof result.options.uploadValidation.magicNumberCheck, "boolean");
    assert.deepEqual(result.options.securityDefense, {});
    assert.equal(result.warnings.some((line) => line.includes("Failed to load")), true);
});

test("lab-options loader falls back to defaults when JSON is invalid", async () => {
    const result = await readLabOptionsViaSubprocess({
        LAB_OPTIONS_MODE: "invalid-json",
    });

    assert.equal(result.options.sqlInjection.enabled, false);
    assert.equal(result.options.csp.enabled, true);
    assert.equal(result.options.xssInjection.storedXss, false);
    assert.deepEqual(result.options.securityDefense, {});
    assert.equal(result.warnings.some((line) => line.includes("Failed to load")), true);
});

test("lab-options loader parses string booleans and recovers invalid nested values", async () => {
    const payload = JSON.stringify({
        sqlInjection: {
            enabled: "true",
            targets: {
                articleLookup: "true",
                boardUpdate: "false",
                articleDelete: "true",
            },
        },
        ssti: { enabled: "true" },
        debug: { errorRoutes: { enabled: true } },
        csrf: { enabled: "false" },
        csp: { enabled: "false" },
        xss: {
            stored: { enabled: "true" },
            reflected404: { enabled: "true" },
            sanitize: {
                clientSide: {
                    enabled: "false",
                    defaultRuleToggles: {
                        lessThan: "false",
                    },
                    customRules: [
                        { from: "<custom>", to: "[custom]" },
                        { from: "", to: "ignored" },
                    ],
                },
                serverSide: {
                    enabled: true,
                    defaultRuleToggles: "bad-type",
                },
            },
        },
        uploadValidation: {
            extensionCheck: "false",
            mimeCheck: "true",
            magicNumberCheck: "true",
        },
        securityDefense: {
            enabled: "true",
            accountLockout: {
                enabled: "true",
                maxFailures: "7",
                lockMinutes: 15,
                useLoginLockUntil: "false",
            },
            passwordReset: {
                tokenTtlMinutes: "25",
                enabled: "true",
                devRevealToken: {
                    enabled: "true",
                },
                pseudoVerify: {
                    enabled: "false",
                },
            },
            rateLimit: {
                enabled: "true",
                maxRequests: "20",
                windowSeconds: "60",
            },
            simpleCaptcha: {
                enabled: "true",
                login: {
                    enabled: "true",
                    afterFailures: "4",
                },
            },
        },
    });

    const result = await readLabOptionsViaSubprocess({
        LAB_OPTIONS_MODE: "payload",
        LAB_OPTIONS_PAYLOAD: payload,
    });

    assert.equal(result.options.sqlInjection.enabled, true);
    assert.equal(result.options.sqlInjection.targets.articleLookup, true);
    assert.equal(result.options.sqlInjection.targets.boardUpdate, false);
    assert.equal(result.options.sqlInjection.targets.articleDelete, true);
    assert.equal(result.options.ssti, true);
    assert.equal(result.options.debugErrorRoutes, true);
    assert.equal(result.options.csp.enabled, false);
    assert.equal(result.options.xssInjection.storedXss, true);
    assert.equal(result.options.xssInjection.reflected404, true);
    assert.equal(result.options.xssInjection.clientSide.sanitizeEnabled, false);
    assert.equal(result.options.xssInjection.clientSide.defaultRuleToggles.lessThan, false);
    assert.equal(result.options.xssInjection.clientSide.customRules.length, 1);
    assert.deepEqual(result.options.xssInjection.clientSide.customRules[0], {
        from: "<custom>",
        to: "[custom]",
    });
    assert.equal(result.options.xssInjection.serverSide.sanitizeEnabled, true);
    assert.equal(result.options.xssInjection.serverSide.defaultRuleToggles.ampersand, true);
    assert.equal(typeof result.options.uploadValidation.extensionCheck, "boolean");
    assert.equal(typeof result.options.uploadValidation.mimeCheck, "boolean");
    assert.equal(typeof result.options.uploadValidation.magicNumberCheck, "boolean");
    assert.equal(result.options.securityDefense.accountLockout.enabled, true);
    assert.equal(result.options.securityDefense.accountLockout.maxFailures, 7);
    assert.equal(result.options.securityDefense.accountLockout.lockMinutes, 15);
    assert.equal(result.options.securityDefense.accountLockout.useLoginLockUntil, false);
    assert.equal(result.options.securityDefense.passwordReset.tokenTtlMinutes, 25);
    assert.equal(result.options.securityDefense.rateLimit.enabled, true);
    assert.equal(result.options.securityDefense.rateLimit.maxRequests, 20);
    assert.equal(result.options.securityDefense.rateLimit.windowSeconds, 60);
    assert.equal(result.options.securityDefense.simpleCaptcha.enabled, true);
    assert.equal(result.options.securityDefense.simpleCaptcha.login.enabled, true);
    assert.equal(result.options.securityDefense.simpleCaptcha.login.afterFailures, 4);
    assert.equal(result.warnings.length > 0, true);
    assert.equal(
        result.warnings.some((line) => line.includes('Deprecated lab option "securityDefense.enabled"')),
        true,
    );
});

test("lab-options loader ignores deprecated SQLi target keys", async () => {
    const payload = JSON.stringify({
        sqlInjection: {
            enabled: true,
            targets: {
                usernameLookup: true,
                registerCreateUser: "false",
                profileLookupByUsername: "true",
                boardLookupBySlug: true,
                postLookup: true,
                postCreate: false,
                postUpdate: "true",
            },
        },
    });

    const result = await readLabOptionsViaSubprocess({
        LAB_OPTIONS_MODE: "payload",
        LAB_OPTIONS_PAYLOAD: payload,
    });

    assert.equal(result.options.sqlInjection.enabled, true);
    assert.equal(result.options.sqlInjection.targets.authLookup, false);
    assert.equal(result.options.sqlInjection.targets.authCreate, false);
    assert.equal(result.options.sqlInjection.targets.profileLookup, false);
    assert.equal(result.options.sqlInjection.targets.boardLookup, false);
    assert.equal(result.options.sqlInjection.targets.articleLookup, false);
    assert.equal(result.options.sqlInjection.targets.articleCreate, false);
    assert.equal(result.options.sqlInjection.targets.articleUpdate, false);
    assert.equal(result.options.sqlInjection.targets.articleDelete, false);
});
