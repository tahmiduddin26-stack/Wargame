import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// OWASP's scrypt configuration with a 32 MiB memory cost and three passes.
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
let hashing = 0;
async function derive(password: string, salt: string): Promise<Buffer> {
  if (hashing >= 4) throw new Error('Account service is busy. Try again shortly.');
  hashing++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, options, (error, hash) => error ? reject(error) : resolve(hash));
    });
  } finally { hashing--; }
}
export function username(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9_]{3,24}$/.test(normalized) ? normalized : null;
}
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 15 && value.length <= 128;
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `scrypt1:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  const parts = encoded?.split(':');
  const valid = parts?.length === 3 && parts[0] === 'scrypt1' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  // Unknown users still pay the same hashing cost and receive the same failure.
  const derived = await derive(password, valid ? parts[1] : '00000000000000000000000000000000');
  return !!valid && timingSafeEqual(derived, Buffer.from(parts[2], 'hex'));
}

/** Limits survive socket replacement. Expired entries are pruned; memory is bounded. */
export class AccountLimiter {
  private attempts = new Map<string, { count: number; expires: number }>();
  constructor(private maximum = 12, private windowMs = 15 * 60 * 1000) {}
  allow(ip: string, user: string, now = Date.now()): boolean {
    for (const [key, value] of this.attempts) if (value.expires <= now) this.attempts.delete(key);
    const keys = [`ip:${ip}`, `user:${user}`];
    if (keys.some((key) => (this.attempts.get(key)?.count ?? 0) >= this.maximum) ||
        this.attempts.size + keys.filter((key) => !this.attempts.has(key)).length > 4096) return false;
    for (const key of keys) {
      const entry = this.attempts.get(key) ?? { count: 0, expires: now + this.windowMs };
      entry.count++; this.attempts.set(key, entry);
    }
    return true;
  }
}
