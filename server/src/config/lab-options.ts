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

export type SqlInjectionOptions = {
    enabled: boolean;
    targets: {
        loginUsername: boolean;
        registerUsernameLookup: boolean;
        registerCreateUser: boolean;
        adminUserUsernameLookup: boolean;
        adminUserCreate: boolean;
        profileLookupByUsername: boolean;
        profileUpdate: boolean;
        boardLookupBySlug: boolean;
        boardCreate: boolean;
        boardUpdate: boolean;
        postLookup: boolean;
        postCreate: boolean;
        postUpdate: boolean;
    };
};

export type CsrfOptions = {
    enabled: boolean;
};

export type LabOptions = {
    sqlInjection: SqlInjectionOptions;
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
    sqlInjection: {
        enabled: false,
        targets: {
            loginUsername: false,
            registerUsernameLookup: false,
            registerCreateUser: false,
            adminUserUsernameLookup: false,
            adminUserCreate: false,
            profileLookupByUsername: false,
            profileUpdate: false,
            boardLookupBySlug: false,
            boardCreate: false,
            boardUpdate: false,
            postLookup: false,
            postCreate: false,
            postUpdate: false,
        },
    },
    ssti: false,
    debugErrorRoutes: false,
    csrf: {
        enabled: false,
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
        sqlInjection: {
            enabled: DEFAULT_LAB_OPTIONS.sqlInjection.enabled,
            targets: { ...DEFAULT_LAB_OPTIONS.sqlInjection.targets },
        },
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

function parseXssSideOptions(value: unknown, keyPrefix: string): XssSideOptions {
    if (typeof value === "undefined") {
        return cloneDefaultXssSideOptions();
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "${keyPrefix}" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return cloneDefaultXssSideOptions();
    }

    const options = value as Record<string, unknown>;
    const sanitizeEnabledRaw = typeof options.enabled !== "undefined"
        ? options.enabled
        : options.sanitizeEnabled;
    const sanitizeEnabledKey = typeof options.enabled !== "undefined"
        ? `${keyPrefix}.enabled`
        : `${keyPrefix}.sanitizeEnabled`;
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
            sanitizeEnabledRaw,
            sanitizeEnabledKey,
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

function getDefaultXssInjectionOptions(): XssInjectionOptions {
    return {
        storedXss: DEFAULT_XSS_INJECTION_OPTIONS.storedXss,
        clientSide: cloneDefaultXssSideOptions(),
        serverSide: cloneDefaultXssSideOptions(),
    };
}

function parseXssInjectionOptions(value: unknown): XssInjectionOptions {
    if (typeof value === "undefined") {
        return getDefaultXssInjectionOptions();
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "XSS" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return getDefaultXssInjectionOptions();
    }

    const options = value as Record<string, unknown>;
    const rawStored = options.stored;
    const parsedStored =
        rawStored && typeof rawStored === "object" && !Array.isArray(rawStored)
            ? (rawStored as Record<string, unknown>)
            : {};
    if (typeof rawStored !== "undefined" && (!rawStored || typeof rawStored !== "object" || Array.isArray(rawStored))) {
        console.warn(`[CONFIG] Invalid lab option "XSS.stored" in ${LAB_OPTIONS_PATH}. Using defaults.`);
    }

    const rawSanitize = options.sanitize;
    const parsedSanitize =
        rawSanitize && typeof rawSanitize === "object" && !Array.isArray(rawSanitize)
            ? (rawSanitize as Record<string, unknown>)
            : {};
    if (typeof rawSanitize !== "undefined" && (!rawSanitize || typeof rawSanitize !== "object" || Array.isArray(rawSanitize))) {
        console.warn(`[CONFIG] Invalid lab option "XSS.sanitize" in ${LAB_OPTIONS_PATH}. Using defaults.`);
    }

    return {
        storedXss: parseBooleanOption(
            parsedStored.enabled,
            "XSS.stored.enabled",
            DEFAULT_XSS_INJECTION_OPTIONS.storedXss,
        ),
        clientSide: parseXssSideOptions(parsedSanitize.clientSide, "XSS.sanitize.clientSide"),
        serverSide: parseXssSideOptions(parsedSanitize.serverSide, "XSS.sanitize.serverSide"),
    };
}

function getDefaultUploadValidationOptions(): UploadValidationOptions {
    return {
        extensionCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.extensionCheckEnabled,
        magicNumberCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.magicNumberCheckEnabled,
    };
}

function parseUploadValidationOptions(value: unknown): UploadValidationOptions {
    if (typeof value === "undefined") {
        return getDefaultUploadValidationOptions();
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "uploadValidation" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return getDefaultUploadValidationOptions();
    }

    const options = value as Record<string, unknown>;
    const rawExtensionCheck = options.extensionCheck;
    const parsedExtensionCheck =
        rawExtensionCheck && typeof rawExtensionCheck === "object" && !Array.isArray(rawExtensionCheck)
            ? (rawExtensionCheck as Record<string, unknown>)
            : {};
    if (typeof rawExtensionCheck !== "undefined" && (!rawExtensionCheck || typeof rawExtensionCheck !== "object" || Array.isArray(rawExtensionCheck))) {
        console.warn(`[CONFIG] Invalid lab option "uploadValidation.extensionCheck" in ${LAB_OPTIONS_PATH}. Using defaults.`);
    }

    const rawMagicNumberCheck = options.magicNumberCheck;
    const parsedMagicNumberCheck =
        rawMagicNumberCheck && typeof rawMagicNumberCheck === "object" && !Array.isArray(rawMagicNumberCheck)
            ? (rawMagicNumberCheck as Record<string, unknown>)
            : {};
    if (typeof rawMagicNumberCheck !== "undefined" && (!rawMagicNumberCheck || typeof rawMagicNumberCheck !== "object" || Array.isArray(rawMagicNumberCheck))) {
        console.warn(`[CONFIG] Invalid lab option "uploadValidation.magicNumberCheck" in ${LAB_OPTIONS_PATH}. Using defaults.`);
    }

    return {
        extensionCheckEnabled: parseBooleanOption(
            parsedExtensionCheck.enabled,
            "uploadValidation.extensionCheck.enabled",
            DEFAULT_LAB_OPTIONS.uploadValidation.extensionCheckEnabled,
        ),
        magicNumberCheckEnabled: parseBooleanOption(
            parsedMagicNumberCheck.enabled,
            "uploadValidation.magicNumberCheck.enabled",
            DEFAULT_LAB_OPTIONS.uploadValidation.magicNumberCheckEnabled,
        ),
    };
}

function parseDebugErrorRoutesOption(value: unknown): boolean {
    if (typeof value === "undefined") {
        return DEFAULT_LAB_OPTIONS.debugErrorRoutes;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "debug" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return DEFAULT_LAB_OPTIONS.debugErrorRoutes;
    }

    const options = value as Record<string, unknown>;
    const rawErrorRoutes = options.errorRoutes;
    const parsedErrorRoutes =
        rawErrorRoutes && typeof rawErrorRoutes === "object" && !Array.isArray(rawErrorRoutes)
            ? (rawErrorRoutes as Record<string, unknown>)
            : {};
    if (typeof rawErrorRoutes !== "undefined" && (!rawErrorRoutes || typeof rawErrorRoutes !== "object" || Array.isArray(rawErrorRoutes))) {
        console.warn(`[CONFIG] Invalid lab option "debug.errorRoutes" in ${LAB_OPTIONS_PATH}. Using defaults.`);
    }

    return parseBooleanOption(
        parsedErrorRoutes.enabled,
        "debug.errorRoutes.enabled",
        DEFAULT_LAB_OPTIONS.debugErrorRoutes,
    );
}

function parseSqlInjectionOptions(value: unknown): SqlInjectionOptions {
    if (typeof value === "undefined") {
        return {
            enabled: DEFAULT_LAB_OPTIONS.sqlInjection.enabled,
            targets: { ...DEFAULT_LAB_OPTIONS.sqlInjection.targets },
        };
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "sqlInjection" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return {
            enabled: DEFAULT_LAB_OPTIONS.sqlInjection.enabled,
            targets: { ...DEFAULT_LAB_OPTIONS.sqlInjection.targets },
        };
    }

    const options = value as Record<string, unknown>;
    const enabled = parseBooleanOption(
        options.enabled,
        "sqlInjection.enabled",
        DEFAULT_LAB_OPTIONS.sqlInjection.enabled,
    );

    const rawTargets = options.targets;
    const parsedTargets =
        rawTargets && typeof rawTargets === "object" && !Array.isArray(rawTargets)
            ? (rawTargets as Record<string, unknown>)
            : undefined;
    if (typeof rawTargets !== "undefined" && !parsedTargets) {
        console.warn(`[CONFIG] Invalid lab option "sqlInjection.targets" in ${LAB_OPTIONS_PATH}. Using defaults.`);
    }

    const targets = {
        loginUsername: parseBooleanOption(
            parsedTargets?.loginUsername,
            "sqlInjection.targets.loginUsername",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.loginUsername,
        ),
        registerUsernameLookup: parseBooleanOption(
            parsedTargets?.registerUsernameLookup,
            "sqlInjection.targets.registerUsernameLookup",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.registerUsernameLookup,
        ),
        registerCreateUser: parseBooleanOption(
            parsedTargets?.registerCreateUser,
            "sqlInjection.targets.registerCreateUser",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.registerCreateUser,
        ),
        adminUserUsernameLookup: parseBooleanOption(
            parsedTargets?.adminUserUsernameLookup,
            "sqlInjection.targets.adminUserUsernameLookup",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.adminUserUsernameLookup,
        ),
        adminUserCreate: parseBooleanOption(
            parsedTargets?.adminUserCreate,
            "sqlInjection.targets.adminUserCreate",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.adminUserCreate,
        ),
        profileLookupByUsername: parseBooleanOption(
            parsedTargets?.profileLookupByUsername,
            "sqlInjection.targets.profileLookupByUsername",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.profileLookupByUsername,
        ),
        profileUpdate: parseBooleanOption(
            parsedTargets?.profileUpdate,
            "sqlInjection.targets.profileUpdate",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.profileUpdate,
        ),
        boardLookupBySlug: parseBooleanOption(
            parsedTargets?.boardLookupBySlug,
            "sqlInjection.targets.boardLookupBySlug",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.boardLookupBySlug,
        ),
        boardCreate: parseBooleanOption(
            parsedTargets?.boardCreate,
            "sqlInjection.targets.boardCreate",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.boardCreate,
        ),
        boardUpdate: parseBooleanOption(
            parsedTargets?.boardUpdate,
            "sqlInjection.targets.boardUpdate",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.boardUpdate,
        ),
        postLookup: parseBooleanOption(
            parsedTargets?.postLookup,
            "sqlInjection.targets.postLookup",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.postLookup,
        ),
        postCreate: parseBooleanOption(
            parsedTargets?.postCreate,
            "sqlInjection.targets.postCreate",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.postCreate,
        ),
        postUpdate: parseBooleanOption(
            parsedTargets?.postUpdate,
            "sqlInjection.targets.postUpdate",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.postUpdate,
        ),
    };

    return {
        enabled,
        targets,
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

function parseSstiOption(value: unknown): boolean {
    if (typeof value === "undefined") {
        return DEFAULT_LAB_OPTIONS.ssti;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "SSTI" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return DEFAULT_LAB_OPTIONS.ssti;
    }

    const options = value as Record<string, unknown>;
    return parseBooleanOption(
        options.enabled,
        "SSTI.enabled",
        DEFAULT_LAB_OPTIONS.ssti,
    );
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
            sqlInjection: parseSqlInjectionOptions(options.sqlInjection),
            ssti: parseSstiOption(options.SSTI),
            debugErrorRoutes: parseDebugErrorRoutesOption(options.debug),
            csrf: parseCsrfOptions(options.csrf),
            xssInjection: parseXssInjectionOptions(options.XSS),
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
