import { eq, and, isNull, gt, lt } from "drizzle-orm";
import { adminSessionsTable } from "../schema";
import type { DB } from "../db";
import { sha256Hex } from "./password";

export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function randomBytes(n: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function uint8ArrayToBase64url(buf: Uint8Array): string {
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function generateToken(): Promise<string> {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  return uint8ArrayToBase64url(buf);
}

export async function createAdminSession(
  db: DB,
  opts: {
    adminId?: number | null;
    userAgent?: string | null;
    ip?: string | null;
    ttlMs?: number;
  },
): Promise<{ token: string; expiresAt: Date }> {
  const token = await generateToken();
  const tokenHash = await sha256Hex(token);
  const ttl = opts.ttlMs ?? ADMIN_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  await db.insert(adminSessionsTable).values({
    tokenHash,
    adminId: opts.adminId ?? null,
    role: "admin",
    expiresAt,
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
  });
  return { token, expiresAt };
}

export async function validateAdminSession(
  db: DB,
  token: string,
): Promise<{ id: number; role: string; adminId: number | null } | null> {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const rows = await db
    .select()
    .from(adminSessionsTable)
    .where(
      and(
        eq(adminSessionsTable.tokenHash, tokenHash),
        isNull(adminSessionsTable.revokedAt),
        gt(adminSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  db.update(adminSessionsTable)
    .set({ lastUsedAt: now })
    .where(eq(adminSessionsTable.id, row.id))
    .catch(() => {});
  return { id: row.id, role: row.role, adminId: row.adminId };
}

export async function revokeAdminSession(db: DB, token: string): Promise<void> {
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await db
    .update(adminSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessionsTable.tokenHash, tokenHash));
}

export async function revokeAllAdminSessions(db: DB): Promise<void> {
  await db
    .update(adminSessionsTable)
    .set({ revokedAt: new Date() })
    .where(isNull(adminSessionsTable.revokedAt));
}
