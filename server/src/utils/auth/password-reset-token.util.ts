import crypto from "node:crypto";

const PASSWORD_RESET_TOKEN_BYTES = 32;

export function generatePasswordResetToken(): string {
    return crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
