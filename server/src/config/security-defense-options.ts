import { getLabOptions } from "./lab-options.js";

export type AccountLockoutOptions = {
    enabled: boolean;
    maxFailures: number;
    lockMinutes: number;
    useLoginLockUntil: boolean;
};

export type PasswordResetOptions = {
    enabled: boolean;
    tokenTtlMinutes: number;
    devRevealToken: {
        enabled: boolean;
    };
    pseudoVerify: {
        enabled: boolean;
    };
};

export type RateLimitOptions = {
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

export type SimpleCaptchaOptions = {
    enabled: boolean;
    login: {
        enabled: boolean;
        afterFailures: number;
    };
};

export type SecurityDefenseOptions = {
    enabled: boolean;
    accountLockout: AccountLockoutOptions;
    passwordReset: PasswordResetOptions;
    rateLimit: RateLimitOptions;
    simpleCaptcha: SimpleCaptchaOptions;
};

/**
 * SECURITY_DEFENSE options are resolved at request time.
 * Precedence: lab-options.json > defaults.
 */
export function getSecurityDefenseOptions(): SecurityDefenseOptions {
    const labSecurityDefense = getLabOptions().securityDefense;

    const enabled = labSecurityDefense.enabled ?? false;
    const accountLockoutEnabled = enabled && (labSecurityDefense.accountLockout?.enabled ?? enabled);
    const passwordResetEnabled = enabled && (labSecurityDefense.passwordReset?.enabled ?? enabled);
    const rateLimitEnabled = enabled && (labSecurityDefense.rateLimit?.enabled ?? false);
    const loginRateLimitEnabled = rateLimitEnabled && (labSecurityDefense.rateLimit?.login?.enabled ?? true);
    const postsMutationRateLimitEnabled = rateLimitEnabled && (labSecurityDefense.rateLimit?.postsMutation?.enabled ?? true);
    const simpleCaptchaEnabled = enabled && (labSecurityDefense.simpleCaptcha?.enabled ?? false);
    const loginSimpleCaptchaEnabled = simpleCaptchaEnabled && (labSecurityDefense.simpleCaptcha?.login?.enabled ?? true);

    return {
        enabled,
        accountLockout: {
            enabled: accountLockoutEnabled,
            maxFailures: labSecurityDefense.accountLockout?.maxFailures ?? 5,
            lockMinutes: labSecurityDefense.accountLockout?.lockMinutes ?? 10,
            useLoginLockUntil: labSecurityDefense.accountLockout?.useLoginLockUntil ?? true,
        },
        passwordReset: {
            enabled: passwordResetEnabled,
            tokenTtlMinutes: labSecurityDefense.passwordReset?.tokenTtlMinutes ?? 20,
            devRevealToken: {
                enabled: passwordResetEnabled && (labSecurityDefense.passwordReset?.devRevealToken?.enabled ?? false),
            },
            pseudoVerify: {
                enabled: passwordResetEnabled && (labSecurityDefense.passwordReset?.pseudoVerify?.enabled ?? false),
            },
        },
        rateLimit: {
            enabled: rateLimitEnabled,
            login: {
                enabled: loginRateLimitEnabled,
                maxRequests: labSecurityDefense.rateLimit?.login?.maxRequests ?? 10,
                windowSeconds: labSecurityDefense.rateLimit?.login?.windowSeconds ?? 60,
            },
            postsMutation: {
                enabled: postsMutationRateLimitEnabled,
                maxRequests: labSecurityDefense.rateLimit?.postsMutation?.maxRequests ?? 20,
                windowSeconds: labSecurityDefense.rateLimit?.postsMutation?.windowSeconds ?? 60,
            },
        },
        simpleCaptcha: {
            enabled: simpleCaptchaEnabled,
            login: {
                enabled: loginSimpleCaptchaEnabled,
                afterFailures: labSecurityDefense.simpleCaptcha?.login?.afterFailures ?? 3,
            },
        },
    };
}
