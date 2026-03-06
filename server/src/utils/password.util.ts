import crypto from 'node:crypto';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

/**
 * password 문자열이 유효한 길이인지 판정합니다.
 *
 * @param password password(평문)
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

/**
 * 패스워드를 scrypt 기반 해시 문자열로 변환합니다.
 *
 * 포맷: `scrypt$<salt-hex>$<derivedKey-hex>`
 *
 * @param password 평문 패스워드
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * 평문 패스워드가 저장된 해시와 일치하는지 검증합니다.
 *
 * @param password 평문 패스워드
 * @param storedHash DB 등에 저장된 해시 문자열(`hashPassword` 결과)
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const salt = parts[1];
  const hash = parts[2];
  if (!salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, 'hex');
  if (expected.length === 0) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);

  return crypto.timingSafeEqual(expected, derivedKey);
}
