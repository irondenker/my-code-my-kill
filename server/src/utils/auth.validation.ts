export function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function isValidUsername(username: string): boolean {
    return username.length >= 3 && username.length <= 50;
}

export function isValidPassword(password: string): boolean {
    return password.length >= 8 && password.length <= 128;
}