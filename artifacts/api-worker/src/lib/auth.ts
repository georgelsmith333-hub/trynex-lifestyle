import { SignJWT, jwtVerify } from "jose";
import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppEnv } from "../types";

export function getJwtSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret || "dev_only_secret_not_for_production");
}

export async function signCustomerToken(
  payload: { id: number; email: string },
  secret: string,
): Promise<string> {
  return new SignJWT({ ...payload, role: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getJwtSecret(secret));
}

export async function verifyCustomerToken(
  token: string,
  secret: string,
): Promise<{ id: number; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(secret));
    if (payload.role !== "customer") return null;
    return {
      id: payload.id as number,
      email: payload.email as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export function extractCustomerToken(c: Context<AppEnv>): string | null {
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return getCookie(c, "customer_token") || null;
}

export async function signPartialTotpToken(
  adminId: number,
  secret: string,
): Promise<string> {
  return new SignJWT({ adminId, type: "totp_partial" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(getJwtSecret(secret));
}

export async function verifyPartialTotpToken(
  token: string,
  secret: string,
): Promise<{ adminId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(secret));
    if (payload.type !== "totp_partial") return null;
    return { adminId: payload.adminId as number };
  } catch {
    return null;
  }
}

export async function signStoragePath(
  path: string,
  expirySeconds: number,
  secret: string,
): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
  const data = new TextEncoder().encode(`${path}:${expiry}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret || "dev_sign_secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return sigB64 + "|" + expiry;
}

export async function verifyStorageSig(
  path: string,
  sigAndExpiry: string,
  secret: string,
): Promise<boolean> {
  try {
    const [sig, expiryStr] = sigAndExpiry.split("|");
    const expiry = parseInt(expiryStr, 10);
    if (!expiry || Date.now() / 1000 > expiry) return false;
    const data = new TextEncoder().encode(`${path}:${expiry}`);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret || "dev_sign_secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBuf = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    );
    return await crypto.subtle.verify("HMAC", key, sigBuf, data);
  } catch {
    return false;
  }
}
