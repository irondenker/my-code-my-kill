import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

const SECURITY_DEFENSE_PROBE_SCRIPT = `
const mode = process.env.SECURITY_DEFENSE_TEST_MODE ?? "defaults";

const keys = [
  "SECURITY_DEFENSE_ENABLED",
  "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED",
  "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES",
  "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES",
  "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL",
  "SECURITY_DEFENSE_PASSWORD_RESET_ENABLED",
  "SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES",
  "SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED",
  "SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED",
];

for (const key of keys) {
  delete process.env[key];
}

if (mode === "enabled") {
  process.env.SECURITY_DEFENSE_ENABLED = "true";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED = "true";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES = "7";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES = "15";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL = "false";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_ENABLED = "true";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES = "30";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED = "true";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED = "true";
}

if (mode === "invalid") {
  process.env.SECURITY_DEFENSE_ENABLED = "not-bool";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES = "0";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES = "abc";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_ENABLED = "true";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES = "0";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED = "not-bool";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED = "not-bool";
}

const { getSecurityDefenseOptions } = await import("./src/config/security-defense-options.ts");
const options = getSecurityDefenseOptions();
console.log(JSON.stringify(options));
`;

async function readOptions(mode: "defaults" | "enabled" | "invalid") {
    const { stdout } = await runTsxInlineScript({
        script: SECURITY_DEFENSE_PROBE_SCRIPT,
        env: {
            SECURITY_DEFENSE_TEST_MODE: mode,
        },
    });
    return JSON.parse(stdout.trim()) as {
        enabled: boolean;
        accountLockout: {
            enabled: boolean;
            maxFailures: number;
            lockMinutes: number;
            useLoginLockUntil: boolean;
        };
        passwordReset: {
            enabled: boolean;
            tokenTtlMinutes: number;
            devRevealToken: {
                enabled: boolean;
            };
            pseudoVerify: {
                enabled: boolean;
            };
        };
    };
}

test("security defense options use safe defaults when env is missing", async () => {
    const options = await readOptions("defaults");

    assert.equal(options.enabled, false);
    assert.equal(options.accountLockout.enabled, false);
    assert.equal(options.accountLockout.maxFailures, 5);
    assert.equal(options.accountLockout.lockMinutes, 10);
    assert.equal(options.accountLockout.useLoginLockUntil, true);
    assert.equal(options.passwordReset.enabled, false);
    assert.equal(options.passwordReset.tokenTtlMinutes, 20);
    assert.equal(options.passwordReset.devRevealToken.enabled, false);
    assert.equal(options.passwordReset.pseudoVerify.enabled, false);
});

test("security defense options parse explicit env values", async () => {
    const options = await readOptions("enabled");

    assert.equal(options.enabled, true);
    assert.equal(options.accountLockout.enabled, true);
    assert.equal(options.accountLockout.maxFailures, 7);
    assert.equal(options.accountLockout.lockMinutes, 15);
    assert.equal(options.accountLockout.useLoginLockUntil, false);
    assert.equal(options.passwordReset.enabled, true);
    assert.equal(options.passwordReset.tokenTtlMinutes, 30);
    assert.equal(options.passwordReset.devRevealToken.enabled, true);
    assert.equal(options.passwordReset.pseudoVerify.enabled, true);
});

test("security defense options recover invalid env values with fallback", async () => {
    const options = await readOptions("invalid");

    assert.equal(options.enabled, false);
    assert.equal(options.accountLockout.enabled, false);
    assert.equal(options.accountLockout.maxFailures, 5);
    assert.equal(options.accountLockout.lockMinutes, 10);
    assert.equal(options.accountLockout.useLoginLockUntil, true);
    assert.equal(options.passwordReset.enabled, false);
    assert.equal(options.passwordReset.tokenTtlMinutes, 20);
    assert.equal(options.passwordReset.devRevealToken.enabled, false);
    assert.equal(options.passwordReset.pseudoVerify.enabled, false);
});
