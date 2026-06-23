/**
 * passwordService.ts
 *
 * Central password hashing & verification module.
 *
 * History:
 *  - Legacy scheme (still used by users created before this module): plain
 *    SHA-256 of `password + 'sm_salt_2025'` — a *single fixed shared salt*.
 *    This is fast (GPU-friendly) and offers no protection against rainbow
 *    tables or identical-password detection.
 *  - New scheme: PBKDF2-SHA-256, 100,000 iterations, with a *per-user random
 *    salt*. Each user stores `password_salt` (hex). When `password_salt` is
 *    empty/missing the hash is treated as a legacy SHA-256 hash.
 *
 * Migration is *lazy & transparent*: the moment a legacy user logs in
 * successfully, we re-hash their password with a fresh random salt and store
 * it. They never notice — no forced reset required.
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 256; // bits → 32 bytes output
const LEGACY_SHARED_SALT = 'sm_salt_2025';

/** Buffer → lowercase hex string */
function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Hex string → Uint8Array */
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/** Generate a cryptographically random per-user salt (16 bytes → 32 hex chars). */
export function generateSalt(): string {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  return bufToHex(saltBytes.buffer);
}

/**
 * Hash a password with PBKDF2-SHA-256 using a per-user salt.
 * @returns hex-encoded 256-bit hash
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  if (!salt) {
    throw new Error('hashPassword requires a non-empty salt. Use formatLegacyHash for legacy hashes.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBuf(salt) as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH
  );

  return bufToHex(derivedBits);
}

/**
 * Reproduce the EXACT legacy SHA-256 hash output (`password + 'sm_salt_2025'`).
 * Used ONLY to verify passwords of users who haven't been upgraded yet.
 */
export async function formatLegacyHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + LEGACY_SHARED_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(hashBuffer);
}

export interface VerifyResult {
  valid: boolean;
  /** true when the stored hash is the legacy SHA-256 scheme and should be upgraded */
  needsUpgrade: boolean;
}

/**
 * Verify a password against a stored hash.
 *
 * - If `salt` is non-empty → modern PBKDF2 verification.
 * - If `salt` is empty/missing → legacy SHA-256 verification. On success,
 *   `needsUpgrade` is set so the caller can transparently re-hash the password.
 *
 * Comparison is done in constant time via a fixed-length compare to mitigate
 * timing attacks.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<VerifyResult> {
  if (!storedHash) return { valid: false, needsUpgrade: false };

  if (salt) {
    const candidate = await hashPassword(password, salt);
    return { valid: constantTimeEqual(candidate, storedHash), needsUpgrade: false };
  }

  // Legacy path
  const legacyCandidate = await formatLegacyHash(password);
  return { valid: constantTimeEqual(legacyCandidate, storedHash), needsUpgrade: true };
}

/**
 * Constant-time string comparison.
 * Compares hashes first, then length, so timing leaks nothing about content.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still walk to keep timing uniform-ish; not critical for hex hashes.
    let mismatch = 1;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      mismatch |= 1;
    }
    return mismatch === 0;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
