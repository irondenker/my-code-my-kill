import fs from "node:fs";
import path from "node:path";

export type EscapeRule = {
    from: string;
    to: string;
};

export type DefaultEscapeRuleToggleKey =
    | "ampersand"
    | "lessThan"
    | "greaterThan"
    | "doubleQuote"
    | "singleQuote"
    | "backtick";

export type DefaultEscapeRuleToggles = Record<DefaultEscapeRuleToggleKey, boolean>;

export type XssSideOptions = {
    sanitizeEnabled: boolean;
    defaultRuleToggles: DefaultEscapeRuleToggles;
    customRules: EscapeRule[];
};

export type XssInjectionOptions = {
    storedXss: boolean;
    clientSide: XssSideOptions;
    serverSide: XssSideOptions;
};

export type UploadValidationOptions = {
    extensionCheckEnabled: boolean;
    magicNumberCheckEnabled: boolean;
};

export type CsrfOptions = {
    enabled: boolean;
};

export type LabOptions = {
    sqli: boolean;
    ssti: boolean;
    debugErrorRoutes: boolean;
    csrf: CsrfOptions;
    xssInjection: XssInjectionOptions;
    uploadValidation: UploadValidationOptions;
};

const LAB_OPTIONS_PATH = path.join(process.cwd(), "lab-options.json");

const DEFAULT_XSS_SIDE_OPTIONS: XssSideOptions = {
    sanitizeEnabled: true,
    defaultRuleToggles: {
        ampersand: true,
        lessThan: true,
        greaterThan: true,
        doubleQuote: true,
        singleQuote: true,
        backtick: true,
    },
    customRules: [],
};

const DEFAULT_XSS_INJECTION_OPTIONS: XssInjectionOptions = {
    storedXss: false,
    clientSide: { ...DEFAULT_XSS_SIDE_OPTIONS },
    serverSide: { ...DEFAULT_XSS_SIDE_OPTIONS },
};

const DEFAULT_LAB_OPTIONS: LabOptions = {
    sqli: false,
    ssti: false,
    debugErrorRoutes: false,
    csrf: {
        enabled: true,
    },
    xssInjection: { ...DEFAULT_XSS_INJECTION_OPTIONS },
    uploadValidation: {
        extensionCheckEnabled: true,
        magicNumberCheckEnabled: true,
    },
};

function cloneDefaultXssSideOptions(): XssSideOptions {
    return {
        sanitizeEnabled: DEFAULT_XSS_SIDE_OPTIONS.sanitizeEnabled,
        defaultRuleToggles: { ...DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles },
        customRules: [...DEFAULT_XSS_SIDE_OPTIONS.customRules],
    };
}

function getDefaultLabOptions(): LabOptions {
    return {
        sqli: DEFAULT_LAB_OPTIONS.sqli,
        ssti: DEFAULT_LAB_OPTIONS.ssti,
        debugErrorRoutes: DEFAULT_LAB_OPTIONS.debugErrorRoutes,
        csrf: {
            enabled: DEFAULT_LAB_OPTIONS.csrf.enabled,
        },
        xssInjection: {
            storedXss: DEFAULT_XSS_INJECTION_OPTIONS.storedXss,
            clientSide: cloneDefaultXssSideOptions(),
            serverSide: cloneDefaultXssSideOptions(),
        },
        uploadValidation: {
            extensionCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.extensionCheckEnabled,
            magicNumberCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.magicNumberCheckEnabled,
        },
    };
}

function parseBooleanOption(value: unknown, key: string, fallback = false): boolean {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
            return true;
        }
        if (normalized === "false") {
            return false;
        }
    }

    if (typeof value !== "undefined") {
        console.warn(`[CONFIG] Invalid lab option "${key}" in ${LAB_OPTIONS_PATH}. Using ${String(fallback)}.`);
    }
    return fallback;
}

function parseEscapeRuleList(value: unknown, key: string): EscapeRule[] {
    if (typeof value === "undefined") {
        return [];
    }

    if (!Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "${key}" in ${LAB_OPTIONS_PATH}. Using empty array.`);
        return [];
    }

    const parsed: EscapeRule[] = [];
    value.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            console.warn(`[CONFIG] Invalid lab option "${key}[${index}]" in ${LAB_OPTIONS_PATH}. Expected object.`);
            return;
        }

        const rule = entry as Record<string, unknown>;
        if (typeof rule.from !== "string" || typeof rule.to !== "string") {
            console.warn(`[CONFIG] Invalid lab option "${key}[${index}]" in ${LAB_OPTIONS_PATH}. "from" and "to" must be strings.`);
            return;
        }

        if (!rule.from) {
            console.warn(`[CONFIG] Invalid lab option "${key}[${index}]" in ${LAB_OPTIONS_PATH}. "from" cannot be empty.`);
            return;
        }

        parsed.push({
            from: rule.from,
            to: rule.to,
        });
    });

    return parsed;
}

function parseXssSideOptions(value: unknown, keyPrefix: "xssInjection.clientSide" | "xssInjection.serverSide"): XssSideOptions {
    if (typeof value === "undefined") {
        return cloneDefaultXssSideOptions();
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "${keyPrefix}" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return cloneDefaultXssSideOptions();
    }

    const options = value as Record<string, unknown>;
    const rawToggles = options.defaultRuleToggles;
    const parsedToggles =
        rawToggles && typeof rawToggles === "object" && !Array.isArray(rawToggles)
            ? (rawToggles as Record<string, unknown>)
            : {};
    if (typeof rawToggles !== "undefined" && (!rawToggles || typeof rawToggles !== "object" || Array.isArray(rawToggles))) {
        console.warn(`[CONFIG] Invalid lab option "${keyPrefix}.defaultRuleToggles" in ${LAB_OPTIONS_PATH}. Using defaults.`);
    }

    return {
        sanitizeEnabled: parseBooleanOption(
            options.sanitizeEnabled,
            `${keyPrefix}.sanitizeEnabled`,
            DEFAULT_XSS_SIDE_OPTIONS.sanitizeEnabled,
        ),
        defaultRuleToggles: {
            ampersand: parseBooleanOption(
                parsedToggles.ampersand,
                `${keyPrefix}.defaultRuleToggles.ampersand`,
                DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles.ampersand,
            ),
            lessThan: parseBooleanOption(
                parsedToggles.lessThan,
                `${keyPrefix}.defaultRuleToggles.lessThan`,
                DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles.lessThan,
            ),
            greaterThan: parseBooleanOption(
                parsedToggles.greaterThan,
                `${keyPrefix}.defaultRuleToggles.greaterThan`,
                DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles.greaterThan,
            ),
            doubleQuote: parseBooleanOption(
                parsedToggles.doubleQuote,
                `${keyPrefix}.defaultRuleToggles.doubleQuote`,
                DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles.doubleQuote,
            ),
            singleQuote: parseBooleanOption(
                parsedToggles.singleQuote,
                `${keyPrefix}.defaultRuleToggles.singleQuote`,
                DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles.singleQuote,
            ),
            backtick: parseBooleanOption(
                parsedToggles.backtick,
                `${keyPrefix}.defaultRuleToggles.backtick`,
                DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles.backtick,
            ),
        },
        customRules: parseEscapeRuleList(options.customRules, `${keyPrefix}.customRules`),
    };
}

function parseXssInjectionOptions(value: unknown): XssInjectionOptions {
    if (typeof value === "undefined") {
        return {
            storedXss: DEFAULT_XSS_INJECTION_OPTIONS.storedXss,
            clientSide: cloneDefaultXssSideOptions(),
            serverSide: cloneDefaultXssSideOptions(),
        };
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "xssInjection" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return {
            storedXss: DEFAULT_XSS_INJECTION_OPTIONS.storedXss,
            clientSide: cloneDefaultXssSideOptions(),
            serverSide: cloneDefaultXssSideOptions(),
        };
    }

    const options = value as Record<string, unknown>;
    return {
        storedXss: parseBooleanOption(
            options.storedXss,
            "xssInjection.storedXss",
            DEFAULT_XSS_INJECTION_OPTIONS.storedXss,
        ),
        clientSide: parseXssSideOptions(options.clientSide, "xssInjection.clientSide"),
        serverSide: parseXssSideOptions(options.serverSide, "xssInjection.serverSide"),
    };
}

function parseUploadValidationOptions(value: unknown): UploadValidationOptions {
    if (typeof value === "undefined") {
        return {
            extensionCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.extensionCheckEnabled,
            magicNumberCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.magicNumberCheckEnabled,
        };
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "uploadValidation" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return {
            extensionCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.extensionCheckEnabled,
            magicNumberCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.magicNumberCheckEnabled,
        };
    }

    const options = value as Record<string, unknown>;
    return {
        extensionCheckEnabled: parseBooleanOption(
            options.extensionCheckEnabled,
            "uploadValidation.extensionCheckEnabled",
            DEFAULT_LAB_OPTIONS.uploadValidation.extensionCheckEnabled,
        ),
        magicNumberCheckEnabled: parseBooleanOption(
            options.magicNumberCheckEnabled,
            "uploadValidation.magicNumberCheckEnabled",
            DEFAULT_LAB_OPTIONS.uploadValidation.magicNumberCheckEnabled,
        ),
    };
}

function parseCsrfOptions(value: unknown): CsrfOptions {
    if (typeof value === "undefined") {
        return {
            enabled: DEFAULT_LAB_OPTIONS.csrf.enabled,
        };
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "csrf" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return {
            enabled: DEFAULT_LAB_OPTIONS.csrf.enabled,
        };
    }

    const options = value as Record<string, unknown>;
    return {
        enabled: parseBooleanOption(
            options.enabled,
            "csrf.enabled",
            DEFAULT_LAB_OPTIONS.csrf.enabled,
        ),
    };
}

function loadLabOptions(): LabOptions {
    try {
        const raw = fs.readFileSync(LAB_OPTIONS_PATH, "utf8");
        const parsed = JSON.parse(raw) as unknown;

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            console.warn(`[CONFIG] Invalid lab options format in ${LAB_OPTIONS_PATH}. Using defaults.`);
            return getDefaultLabOptions();
        }

        const options = parsed as Record<string, unknown>;
        return {
            sqli: parseBooleanOption(options.sqli, "sqli", DEFAULT_LAB_OPTIONS.sqli),
            ssti: parseBooleanOption(options.ssti, "ssti", DEFAULT_LAB_OPTIONS.ssti),
            debugErrorRoutes: parseBooleanOption(
                options.debugErrorRoutes,
                "debugErrorRoutes",
                DEFAULT_LAB_OPTIONS.debugErrorRoutes,
            ),
            csrf: parseCsrfOptions(options.csrf),
            xssInjection: parseXssInjectionOptions(options.xssInjection),
            uploadValidation: parseUploadValidationOptions(options.uploadValidation),
        };
    } catch (err) {
        console.warn(`[CONFIG] Failed to load ${LAB_OPTIONS_PATH}. Using defaults.`);
        return getDefaultLabOptions();
    }
}

const labOptions = loadLabOptions();

export function getLabOptions(): LabOptions {
    return labOptions;
}
