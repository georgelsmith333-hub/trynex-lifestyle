import { pbkdf2 as pbkdf2Cb, randomBytes } from "crypto";
import { promisify } from "util";
import { argon2Verify } from "hash-wasm";

const pbkdf2 = promisify(pbkdf2Cb);

// ---------------------------------------------------------------------------
// PBKDF2-SHA256 via Node.js crypto (available via nodejs_compat CF flag)
// CF Workers cap PBKDF2 iterations at 100,000.
// Format: $pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>
// ---------------------------------------------------------------------------
const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  return `$pbkdf2-sha256$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPasswordPbkdf2(encoded: string, password: string): Promise<boolean> {
  try {
    const parts = encoded.split("$");
    // $pbkdf2-sha256$<iter>$<saltHex>$<hashHex>  → parts[0]="" parts[1]="pbkdf2-sha256" ...
    if (parts.length !== 5 || parts[1] !== "pbkdf2-sha256") return false;
    const iterations = parseInt(parts[2], 10);
    const salt = Buffer.from(parts[3], "hex");
    const expected = Buffer.from(parts[4], "hex");
    const candidate = await pbkdf2(password, salt, iterations, expected.length, "sha256");
    if (candidate.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) diff |= candidate[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// Kept for backward-compat: verify hashes produced by older argon2 implementations.
export async function verifyPasswordArgon2(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify({ hash, password });
  } catch {
    return false;
  }
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

export async function hashPasswordSha256(password: string, salt: string): Promise<string> {
  return sha256Hex(password + salt);
}

export function isArgon2Hash(hash: string): boolean {
  return hash.startsWith("$argon2");
}

export function isPbkdf2Hash(hash: string): boolean {
  return hash.startsWith("$pbkdf2-sha256$");
}

export function isSha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

export async function verifyPasswordAny(
  hash: string,
  password: string,
  sha256Salt: string,
): Promise<boolean> {
  if (isPbkdf2Hash(hash)) {
    return verifyPasswordPbkdf2(hash, password);
  }
  if (isArgon2Hash(hash)) {
    return verifyPasswordArgon2(hash, password);
  }
  if (isSha256Hash(hash)) {
    const computed = await hashPasswordSha256(password, sha256Salt);
    return computed === hash;
  }
  return false;
}
