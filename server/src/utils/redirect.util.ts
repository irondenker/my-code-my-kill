export function isSafeRedirectPath(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }

    if (value.length === 0) {
        return false;
    }

    if (!value.startsWith("/")) {
        return false;
    }

    if (value.startsWith("//")) {
        return false;
    }

    if (value.includes("://")) {
        return false;
    }

    if (value.includes("\\")) {
        return false;
    }

    return true;
}

export function getSafeRedirectPath(value: unknown, fallback: string): string {
    return isSafeRedirectPath(value) ? value : fallback;
}
