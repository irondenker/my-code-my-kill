import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

const SECURITY_DEFENSE_PROBE_SCRIPT = `
import fs from "node:fs";

const labMode = process.env.SECURITY_DEFENSE_LAB_MODE ?? "missing";
const labPayload = process.env.SECURITY_DEFENSE_LAB_PAYLOAD ?? "";
const envNoise = process.env.SECURITY_DEFENSE_ENV_NOISE ?? "off";

if (envNoise === "on") {
  process.env.SECURITY_DEFENSE_ENABLED = "true";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED = "true";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES = "9";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES = "99";
  process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL = "false";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_ENABLED = "true";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES = "99";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED = "true";
  process.env.SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED = "true";
}

const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function (targetPath, ...rest) {
  const pathname = String(targetPath);
  const isLabOptionsPath = pathname.endsWith("/lab-options.json") || pathname.endsWith("\\\\lab-options.json");

  if (!isLabOptionsPath) {
    return originalReadFileSync.call(fs, targetPath, ...rest);
  }

  if (labMode === "missing") {
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    throw error;
  }

  if (labMode === "payload") {
    return labPayload;
  }

  return originalReadFileSync.call(fs, targetPath, ...rest);
};

const { getSecurityDefenseOptions } = await import("./src/config/security-defense-options.ts");
const options = getSecurityDefenseOptions();
console.log(JSON.stringify(options));
`;

type LabMode = "missing" | "payload";

async function readOptions(params: {
    labMode: LabMode;
    labPayload?: string;
    envNoise?: boolean;
}) {
    const { stdout } = await runTsxInlineScript({
        script: SECURITY_DEFENSE_PROBE_SCRIPT,
        env: {
            SECURITY_DEFENSE_LAB_MODE: params.labMode,
            SECURITY_DEFENSE_LAB_PAYLOAD: params.labPayload ?? "",
            SECURITY_DEFENSE_ENV_NOISE: params.envNoise ? "on" : "off",
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
        rateLimit: {
            enabled: boolean;
            login: {
                enabled: boolean;
                maxRequests: number;
                windowSeconds: number;
            };
            postsMutation: {
                enabled: boolean;
                maxRequests: number;
                windowSeconds: number;
            };
        };
        simpleCaptcha: {
            enabled: boolean;
            login: {
                enabled: boolean;
                afterFailures: number;
            };
        };
    };
}

function assertSecurityDefenseOptionShape(options: Awaited<ReturnType<typeof readOptions>>) {
    assert.equal(typeof options.enabled, "boolean");

    assert.equal(typeof options.accountLockout.enabled, "boolean");
    assert.equal(typeof options.accountLockout.maxFailures, "number");
    assert.equal(Number.isInteger(options.accountLockout.maxFailures), true);
    assert.equal(options.accountLockout.maxFailures > 0, true);
    assert.equal(typeof options.accountLockout.lockMinutes, "number");
    assert.equal(Number.isInteger(options.accountLockout.lockMinutes), true);
    assert.equal(options.accountLockout.lockMinutes > 0, true);
    assert.equal(typeof options.accountLockout.useLoginLockUntil, "boolean");

    assert.equal(typeof options.passwordReset.enabled, "boolean");
    assert.equal(typeof options.passwordReset.tokenTtlMinutes, "number");
    assert.equal(Number.isInteger(options.passwordReset.tokenTtlMinutes), true);
    assert.equal(options.passwordReset.tokenTtlMinutes > 0, true);
    assert.equal(typeof options.passwordReset.devRevealToken.enabled, "boolean");
    assert.equal(typeof options.passwordReset.pseudoVerify.enabled, "boolean");

    assert.equal(typeof options.rateLimit.enabled, "boolean");
    assert.equal(typeof options.rateLimit.login.enabled, "boolean");
    assert.equal(typeof options.rateLimit.login.maxRequests, "number");
    assert.equal(Number.isInteger(options.rateLimit.login.maxRequests), true);
    assert.equal(options.rateLimit.login.maxRequests > 0, true);
    assert.equal(typeof options.rateLimit.login.windowSeconds, "number");
    assert.equal(Number.isInteger(options.rateLimit.login.windowSeconds), true);
    assert.equal(options.rateLimit.login.windowSeconds > 0, true);
    assert.equal(typeof options.rateLimit.postsMutation.enabled, "boolean");
    assert.equal(typeof options.rateLimit.postsMutation.maxRequests, "number");
    assert.equal(Number.isInteger(options.rateLimit.postsMutation.maxRequests), true);
    assert.equal(options.rateLimit.postsMutation.maxRequests > 0, true);
    assert.equal(typeof options.rateLimit.postsMutation.windowSeconds, "number");
    assert.equal(Number.isInteger(options.rateLimit.postsMutation.windowSeconds), true);
    assert.equal(options.rateLimit.postsMutation.windowSeconds > 0, true);

    assert.equal(typeof options.simpleCaptcha.enabled, "boolean");
    assert.equal(typeof options.simpleCaptcha.login.enabled, "boolean");
    assert.equal(typeof options.simpleCaptcha.login.afterFailures, "number");
    assert.equal(Number.isInteger(options.simpleCaptcha.login.afterFailures), true);
    assert.equal(options.simpleCaptcha.login.afterFailures > 0, true);
}

test("security defense options use defaults when lab-options is missing", async () => {
    const options = await readOptions({
        labMode: "missing",
    });

    assertSecurityDefenseOptionShape(options);
});

test("security defense options ignore SECURITY_DEFENSE env variables", async () => {
    const baseline = await readOptions({
        labMode: "missing",
    });
    const optionsWithEnvNoise = await readOptions({
        labMode: "missing",
        envNoise: true,
    });

    assertSecurityDefenseOptionShape(optionsWithEnvNoise);
    assert.deepEqual(optionsWithEnvNoise, baseline);
});

test("security defense options parse lab-options values", async () => {
    const options = await readOptions({
        labMode: "payload",
        labPayload: JSON.stringify({
            securityDefense: {
                enabled: true,
                accountLockout: {
                    enabled: true,
                    maxFailures: 7,
                    lockMinutes: 15,
                    useLoginLockUntil: false,
                },
                passwordReset: {
                    enabled: true,
                    tokenTtlMinutes: 30,
                    devRevealToken: {
                        enabled: true,
                    },
                    pseudoVerify: {
                        enabled: true,
                    },
                },
                rateLimit: {
                    enabled: true,
                    login: {
                        enabled: true,
                        maxRequests: 8,
                        windowSeconds: 45,
                    },
                    postsMutation: {
                        enabled: true,
                        maxRequests: 12,
                        windowSeconds: 30,
                    },
                },
                simpleCaptcha: {
                    enabled: true,
                    login: {
                        enabled: true,
                        afterFailures: 4,
                    },
                },
            },
        }),
    });

    assert.equal(options.enabled, true);
    assert.equal(options.accountLockout.enabled, true);
    assert.equal(options.accountLockout.maxFailures, 7);
    assert.equal(options.accountLockout.lockMinutes, 15);
    assert.equal(options.accountLockout.useLoginLockUntil, false);
    assert.equal(options.passwordReset.enabled, true);
    assert.equal(options.passwordReset.tokenTtlMinutes, 30);
    assert.equal(options.passwordReset.devRevealToken.enabled, true);
    assert.equal(options.passwordReset.pseudoVerify.enabled, true);
    assert.equal(options.rateLimit.enabled, true);
    assert.equal(options.rateLimit.login.enabled, true);
    assert.equal(options.rateLimit.login.maxRequests, 8);
    assert.equal(options.rateLimit.login.windowSeconds, 45);
    assert.equal(options.rateLimit.postsMutation.enabled, true);
    assert.equal(options.rateLimit.postsMutation.maxRequests, 12);
    assert.equal(options.rateLimit.postsMutation.windowSeconds, 30);
    assert.equal(options.simpleCaptcha.enabled, true);
    assert.equal(options.simpleCaptcha.login.enabled, true);
    assert.equal(options.simpleCaptcha.login.afterFailures, 4);
});

test("security defense options fallback on missing nested lab values", async () => {
    const baseline = await readOptions({
        labMode: "missing",
    });
    const options = await readOptions({
        labMode: "payload",
        labPayload: JSON.stringify({
            securityDefense: {
                enabled: true,
            },
        }),
    });

    assertSecurityDefenseOptionShape(options);
    assert.equal(options.enabled, true);
    assert.equal(options.accountLockout.enabled, true);
    assert.equal(options.accountLockout.maxFailures, baseline.accountLockout.maxFailures);
    assert.equal(options.accountLockout.lockMinutes, baseline.accountLockout.lockMinutes);
    assert.equal(options.accountLockout.useLoginLockUntil, baseline.accountLockout.useLoginLockUntil);
    assert.equal(options.passwordReset.enabled, true);
    assert.equal(options.passwordReset.tokenTtlMinutes, baseline.passwordReset.tokenTtlMinutes);
    assert.equal(options.passwordReset.devRevealToken.enabled, baseline.passwordReset.devRevealToken.enabled);
    assert.equal(options.passwordReset.pseudoVerify.enabled, baseline.passwordReset.pseudoVerify.enabled);
    assert.equal(options.rateLimit.enabled, baseline.rateLimit.enabled);
    assert.equal(options.rateLimit.login.enabled, baseline.rateLimit.login.enabled);
    assert.equal(options.rateLimit.login.maxRequests, baseline.rateLimit.login.maxRequests);
    assert.equal(options.rateLimit.login.windowSeconds, baseline.rateLimit.login.windowSeconds);
    assert.equal(options.rateLimit.postsMutation.enabled, baseline.rateLimit.postsMutation.enabled);
    assert.equal(options.rateLimit.postsMutation.maxRequests, baseline.rateLimit.postsMutation.maxRequests);
    assert.equal(options.rateLimit.postsMutation.windowSeconds, baseline.rateLimit.postsMutation.windowSeconds);
    assert.equal(options.simpleCaptcha.enabled, baseline.simpleCaptcha.enabled);
    assert.equal(options.simpleCaptcha.login.enabled, baseline.simpleCaptcha.login.enabled);
    assert.equal(options.simpleCaptcha.login.afterFailures, baseline.simpleCaptcha.login.afterFailures);
});
