export function normalizeUsernameParam(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function isPublicProfileHandle(value: string): boolean {
    if (!value) {
        return false;
    }

    if (value.startsWith("@")) {
        return false;
    }

    return true;
}
