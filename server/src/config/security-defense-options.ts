import { getLabOptions } from './lab-options.js';

export type AccountLockoutOptions = {
  enabled: boolean;
  maxFailures: number;
  lockMinutes: number;
  useLoginLockUntil: boolean;
};

export type PasswordResetOptions = {
  tokenTtlMinutes: number;
};

export type RateLimitOptions = {
  enabled: boolean;
  maxRequests: number;
  windowSeconds: number;
};

export type SimpleCaptchaOptions = {
  enabled: boolean;
  login: {
    enabled: boolean;
    afterFailures: number;
  };
};

export type SecurityDefenseOptions = {
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

  const accountLockoutEnabled = labSecurityDefense.accountLockout?.enabled ?? false;
  const rateLimitEnabled = labSecurityDefense.rateLimit?.enabled ?? false;
  const simpleCaptchaEnabled = labSecurityDefense.simpleCaptcha?.enabled ?? false;
  const loginSimpleCaptchaEnabled =
    simpleCaptchaEnabled && (labSecurityDefense.simpleCaptcha?.login?.enabled ?? true);

  return {
    accountLockout: {
      enabled: accountLockoutEnabled,
      maxFailures: labSecurityDefense.accountLockout?.maxFailures ?? 5,
      lockMinutes: labSecurityDefense.accountLockout?.lockMinutes ?? 10,
      useLoginLockUntil: labSecurityDefense.accountLockout?.useLoginLockUntil ?? true,
    },
    passwordReset: {
      tokenTtlMinutes: labSecurityDefense.passwordReset?.tokenTtlMinutes ?? 20,
    },
    rateLimit: {
      enabled: rateLimitEnabled,
      maxRequests: labSecurityDefense.rateLimit?.maxRequests ?? 20,
      windowSeconds: labSecurityDefense.rateLimit?.windowSeconds ?? 60,
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
