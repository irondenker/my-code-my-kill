import crypto from "node:crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
    const derivedKey = crypto
        .scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
        .toString("hex");
    return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") {
        return false;
    }

    const salt = parts[1];
    const hash = parts[2];
    if (!salt || !hash) {
        return false;
    }
    const expected = Buffer.from(hash, "hex");
    if (expected.length === 0) {
        return false;
    }

    const derivedKey = crypto.scryptSync(
        password,
        salt,
        expected.length,
        SCRYPT_OPTIONS
    );

    return crypto.timingSafeEqual(expected, derivedKey);
}
