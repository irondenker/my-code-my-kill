import fs from "node:fs";
import path from "node:path";

/**
 * Lab 옵션(취약점 실습용 토글) 로더/파서입니다.
 *
 * - `lab-options.json`을 읽어 실행 중 기능 토글을 제어합니다.
 * - JSON 스키마가 완벽히 일치하지 않아도, 가능한 한 값을 복구하고 나머지는 기본값으로 폴백합니다.
 * - 잘못된 타입/형식은 `console.warn`으로만 알리고, 서버 부팅을 실패시키지 않습니다.
 *
 * 주의:
 * - 현재 구현은 프로세스 시작 시 1회 로드한 스냅샷을 반환합니다(런타임 재로딩 없음).
 */
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
        usernameLookup: boolean;
        registerCreateUser: boolean;
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

// 프로젝트 루트에서 `lab-options.json`을 찾습니다.
const LAB_OPTIONS_PATH = path.join(process.cwd(), "lab-options.json");

// XSS 옵션은 client/server 양쪽에서 동일한 기본값을 공유하므로 "clone"해서 사용합니다.
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
            usernameLookup: false,
            registerCreateUser: false,
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

/**
 * 기본 XSS 사이드 옵션을 "깊은 복사"로 생성합니다.
 * (특히 `defaultRuleToggles`, `customRules`는 참조 공유를 피합니다.)
 */
function cloneDefaultXssSideOptions(): XssSideOptions {
    return {
        sanitizeEnabled: DEFAULT_XSS_SIDE_OPTIONS.sanitizeEnabled,
        defaultRuleToggles: { ...DEFAULT_XSS_SIDE_OPTIONS.defaultRuleToggles },
        customRules: [...DEFAULT_XSS_SIDE_OPTIONS.customRules],
    };
}

/**
 * 전체 Lab 옵션의 기본값을 새 객체로 반환합니다.
 * 이 함수는 호출자 간 참조 공유를 피하기 위해 매번 새 객체를 생성합니다.
 */
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

/**
 * boolean 토글을 느슨하게 파싱합니다.
 *
 * - boolean이면 그대로 사용
 * - string "true"/"false"는 허용
 * - 그 외는 경고 후 fallback 사용
 *
 * 기대 형태(값):
 * - `true | false | "true" | "false"`
 */
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

/**
 * 커스텀 이스케이프 룰 목록을 파싱합니다.
 * 각 원소는 `{ from: string, to: string }` 형태여야 하며, from은 비어 있으면 안 됩니다.
 *
 * 기대 형태(값):
 * - `[{ "from": "<non-empty>", "to": "<string>" }, ...]`
 */
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

/**
 * XSS sanitize 옵션(clientSide/serverSide 공통)의 파서입니다.
 *
 * 기대 형태(부분 JSON):
 * - `{ "enabled": boolean, "defaultRuleToggles": { ... }, "customRules": [...] }`
 * - enabled는 `keyPrefix + ".enabled"`에서 읽습니다.
 * - defaultRuleToggles는 `keyPrefix + ".defaultRuleToggles"`에서 읽습니다.
 * - customRules는 `keyPrefix + ".customRules"`에서 읽습니다.
 *
 * defaultRuleToggles 기대 형태:
 * - `{ "ampersand": boolean, "lessThan": boolean, "greaterThan": boolean, "doubleQuote": boolean, "singleQuote": boolean, "backtick": boolean }`
 *
 * customRules 기대 형태:
 * - `[{ "from": string, "to": string }, ...]`
 */
function parseXssSideOptions(value: unknown, keyPrefix: string): XssSideOptions {
    if (typeof value === "undefined") {
        return cloneDefaultXssSideOptions();
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[CONFIG] Invalid lab option "${keyPrefix}" in ${LAB_OPTIONS_PATH}. Using defaults.`);
        return cloneDefaultXssSideOptions();
    }

    const options = value as Record<string, unknown>;
    // 레거시 호환성 제거: `sanitizeEnabled`는 더 이상 읽지 않습니다.
    if (typeof options.sanitizeEnabled !== "undefined") {
        console.warn(
            `[CONFIG] Deprecated lab option "${keyPrefix}.sanitizeEnabled" in ${LAB_OPTIONS_PATH}. Use "${keyPrefix}.enabled" instead.`,
        );
    }

    const sanitizeEnabledRaw = options.enabled;
    const sanitizeEnabledKey = `${keyPrefix}.enabled`;
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

/**
 * XSS injection 옵션의 기본값을 새 객체로 반환합니다.
 */
function getDefaultXssInjectionOptions(): XssInjectionOptions {
    return {
        storedXss: DEFAULT_XSS_INJECTION_OPTIONS.storedXss,
        clientSide: cloneDefaultXssSideOptions(),
        serverSide: cloneDefaultXssSideOptions(),
    };
}

/**
 * XSS 설정 루트(`XSS`)를 파싱합니다.
 *
 * 기대 형태(부분 JSON):
 * - `XSS: { "stored": { "enabled": boolean }, "sanitize": { "clientSide": {...}, "serverSide": {...} } }`
 *
 * 상세:
 * - `XSS.stored.enabled`: stored XSS 시뮬레이션 on/off
 * - `XSS.sanitize.clientSide|serverSide`: sanitize on/off + 룰 토글/커스텀 룰
 */
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

/**
 * 업로드 검증(extension/magic number) 옵션 기본값을 새 객체로 반환합니다.
 */
function getDefaultUploadValidationOptions(): UploadValidationOptions {
    return {
        extensionCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.extensionCheckEnabled,
        magicNumberCheckEnabled: DEFAULT_LAB_OPTIONS.uploadValidation.magicNumberCheckEnabled,
    };
}

/**
 * 업로드 검증 옵션을 파싱합니다.
 *
 * 기대 형태(부분 JSON):
 * - `uploadValidation: { "extensionCheck": { "enabled": boolean }, "magicNumberCheck": { "enabled": boolean } }`
 */
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

/**
 * 디버그용 에러 라우트 토글을 파싱합니다.
 *
 * 기대 형태(부분 JSON):
 * - `debug: { "errorRoutes": { "enabled": boolean } }`
 */
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

/**
 * SQL injection 시뮬레이션 옵션을 파싱합니다.
 *
 * - `sqlInjection.enabled`가 false면 전체적으로 꺼진 것으로 간주하되,
 *   개별 타깃 토글은 "UI/실험 편의"를 위해 함께 보관합니다.
 * - `sqlInjection.targets.*`는 각 코드 경로에 대한 개별 토글입니다.
 *
 * 기대 형태(부분 JSON):
 * - `sqlInjection: { "enabled": boolean, "targets": { "<targetKey>": boolean, ... } }`
 *
 * targets 키 목록:
 * - usernameLookup, registerCreateUser, adminUserCreate
 * - profileLookupByUsername, profileUpdate
 * - boardLookupBySlug, boardCreate, boardUpdate
 * - postLookup, postCreate, postUpdate
 */
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
        usernameLookup: parseBooleanOption(
            parsedTargets?.usernameLookup,
            "sqlInjection.targets.usernameLookup",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.usernameLookup,
        ),
        registerCreateUser: parseBooleanOption(
            parsedTargets?.registerCreateUser,
            "sqlInjection.targets.registerCreateUser",
            DEFAULT_LAB_OPTIONS.sqlInjection.targets.registerCreateUser,
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

/**
 * CSRF 토글을 파싱합니다.
 *
 * 기대 형태(부분 JSON):
 * - `csrf: { "enabled": boolean }`
 */
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

/**
 * SSTI 토글을 파싱합니다.
 *
 * 기대 형태(부분 JSON):
 * - `SSTI: { "enabled": boolean }` (키가 대문자인 것에 주의)
 */
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

/**
 * `lab-options.json`을 로드해 LabOptions로 변환합니다.
 * 파일이 없거나 JSON이 깨졌거나 포맷이 틀린 경우, 기본값으로 폴백합니다.
 *
 * 기대 형태(최상위 부분 JSON):
 * - `{"sqlInjection": {...}, "SSTI": {...}, "debug": {...}, "csrf": {...}, "XSS": {...}, "uploadValidation": {...}}`
 */
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

// 프로세스 시작 시 1회 로드한 스냅샷입니다(의도적으로 재로딩하지 않음).
const labOptions = loadLabOptions();

/**
 * 로드된 Lab 옵션 스냅샷을 반환합니다.
 * 현재 구현은 런타임에 파일 변경을 감지/반영하지 않습니다.
 */
export function getLabOptions(): LabOptions {
    return labOptions;
}
