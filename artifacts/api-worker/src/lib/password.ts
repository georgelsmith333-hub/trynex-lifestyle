import { argon2id, verifyHash } from "hash-wasm";

async function getRandomSalt(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function hashPasswordArgon2(password: string): Promise<string> {
  const salt = await getRandomSalt();
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 32768,
    hashLength: 32,
    outputType: "encoded",
  });
}

export async function verifyPasswordArgon2(hash: string, password: string): Promise<boolean> {
  try {
    return await verifyHash(hash, password);
  } catch {
    return false;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hashPasswordSha256Sync(password: string, salt: string): string {
  // Workers don't have synchronous crypto.createHash; use async sha256Hex instead
  // This is kept for legacy verification path but should be called via verifyPasswordAny
  throw new Error("Use hashPasswordSha256 (async) in Workers");
}

export async function hashPasswordSha256(password: string, salt: string): Promise<string> {
  return sha256Hex(password + salt);
}

export function isArgon2Hash(hash: string): boolean {
  return hash.startsWith("$argon2");
}

export function isSha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

export async function verifyPasswordAny(
  hash: string,
  password: string,
  sha256Salt: string,
): Promise<boolean> {
  if (isArgon2Hash(hash)) {
    return verifyPasswordArgon2(hash, password);
  }
  if (isSha256Hash(hash)) {
    const computed = await hashPasswordSha256(password, sha256Salt);
    return computed === hash;
  }
  return false;
}
