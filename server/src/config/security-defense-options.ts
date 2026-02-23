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

export type SecurityDefenseOptions = {
    enabled: boolean;
    accountLockout: AccountLockoutOptions;
    passwordReset: PasswordResetOptions;
};

function parseBooleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (typeof raw === "undefined") {
        return fallback;
    }

    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
        return false;
    }

    console.warn(`[CONFIG] Invalid boolean env ${name}="${raw}". Using ${String(fallback)}.`);
    return fallback;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (typeof raw === "undefined") {
        return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
    }

    console.warn(`[CONFIG] Invalid positive integer env ${name}="${raw}". Using ${String(fallback)}.`);
    return fallback;
}

/**
 * SECURITY_DEFENSE 옵션은 환경변수에서 요청 시점에 읽습니다.
 * (테스트에서 env를 바꿔가며 검증할 수 있도록 캐시하지 않습니다.)
 */
export function getSecurityDefenseOptions(): SecurityDefenseOptions {
    const enabled = parseBooleanEnv("SECURITY_DEFENSE_ENABLED", false);
    const accountLockoutEnabled = enabled && parseBooleanEnv("SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED", enabled);
    const passwordResetEnabled = enabled && parseBooleanEnv("SECURITY_DEFENSE_PASSWORD_RESET_ENABLED", enabled);

    return {
        enabled,
        accountLockout: {
            enabled: accountLockoutEnabled,
            maxFailures: parsePositiveIntEnv("SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES", 5),
            lockMinutes: parsePositiveIntEnv("SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES", 10),
            useLoginLockUntil: parseBooleanEnv("SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL", true),
        },
        passwordReset: {
            enabled: passwordResetEnabled,
            tokenTtlMinutes: parsePositiveIntEnv("SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES", 20),
            devRevealToken: {
                enabled:
                    passwordResetEnabled &&
                    parseBooleanEnv("SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED", false),
            },
            pseudoVerify: {
                enabled: passwordResetEnabled && parseBooleanEnv("SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED", false),
            },
        },
    };
}
