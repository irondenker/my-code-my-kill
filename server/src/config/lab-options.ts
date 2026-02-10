import fs from "node:fs";
import path from "node:path";

export type LabOptions = {
    storedXss: boolean;
    sqli: boolean;
    debugErrorRoutes: boolean;
};

const LAB_OPTIONS_PATH = path.join(process.cwd(), "lab-options.json");

function parseBooleanOption(value: unknown, key: keyof LabOptions): boolean {
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
        console.warn(`[CONFIG] Invalid lab option "${key}" in ${LAB_OPTIONS_PATH}. Using false.`);
    }
    return false;
}

function loadLabOptions(): LabOptions {
    try {
        const raw = fs.readFileSync(LAB_OPTIONS_PATH, "utf8");
        const parsed = JSON.parse(raw) as unknown;

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            console.warn(`[CONFIG] Invalid lab options format in ${LAB_OPTIONS_PATH}. Using defaults.`);
            return {
                storedXss: false,
                sqli: false,
                debugErrorRoutes: false,
            };
        }

        const options = parsed as Record<string, unknown>;
        return {
            storedXss: parseBooleanOption(options.storedXss, "storedXss"),
            sqli: parseBooleanOption(options.sqli, "sqli"),
            debugErrorRoutes: parseBooleanOption(options.debugErrorRoutes, "debugErrorRoutes"),
        };
    } catch (err) {
        console.warn(`[CONFIG] Failed to load ${LAB_OPTIONS_PATH}. Using defaults.`);
        return {
            storedXss: false,
            sqli: false,
            debugErrorRoutes: false,
        };
    }
}

const labOptions = loadLabOptions();

export function getLabOptions(): LabOptions {
    return labOptions;
}
