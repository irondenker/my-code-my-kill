function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number env: ${name}=${raw}`);
  return n;
}

function toBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(raw.toLowerCase());
}

export const dbEnv = {
  host: process.env.DB_HOST ?? 'localhost',
  port: toNumber('DB_PORT', 5432),
  name: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  logging: toBool('DB_LOGGING', false),
};
