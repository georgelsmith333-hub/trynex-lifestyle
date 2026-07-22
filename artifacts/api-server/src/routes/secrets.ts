import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/adminAuth";
import { logger } from "../lib/logger";
import { z } from "zod";
import { db, adminTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyTotp } from "../lib/totp";

const router: IRouter = Router();

// ── Schemas ──
const UpdateSecretSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

const BulkUpdateSchema = z.object({
  secrets: z.record(z.string()),
});

// ── SENSITIVE KEY PATTERNS — values are masked in API responses ──
const SENSITIVE_PATTERNS = [
  /password/i, /secret/i, /token/i, /key/i, /api_key/i, /apikey/i,
  /private/i, /credential/i, /auth/i, /salt/i, /jwt/i, /session/i,
  /cookie/i, /seed/i, /mnemonic/i, /hash/i, /salt/i, /pin/i, /otp/i,
  /totp/i, /passphrase/i, /bearer/i, /access_token/i, /refresh_token/i,
  /client_secret/i, /signing/i, /encryption/i, /decrypt/i, /sign/i,
  /github_token/i, /render_api/i, /cfut_/i, /r2_secret/i, /database_url/i,
  /redis_url/i, /upstash_redis/i, /telegram_bot_token/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some(p => p.test(key));
}

function maskValue(value: string, key: string): string {
  if (!isSensitiveKey(key)) return value;
  if (value.length <= 8) return "*".repeat(value.length);
  return value.slice(0, 3) + "*".repeat(Math.max(4, value.length - 6)) + value.slice(-3);
}

// ── GET /api/admin/secrets — list all environment variables ──
router.get("/admin/secrets", requireAdmin, (_req, res) => {
  try {
    const envVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      envVars[key] = maskValue(value, key);
    }
    res.json({
      ok: true,
      secrets: envVars,
      count: Object.keys(envVars).length,
      sensitiveCount: Object.keys(envVars).filter(k => isSensitiveKey(k)).length,
    });
  } catch (err) {
    logger.error({ err }, "Failed to list secrets");
    res.status(500).json({ ok: false, error: "Failed to list secrets" });
  }
});

// ── GET /api/admin/secrets/raw — get actual unmasked values (admin only) ──
// Requires an additional TOTP re-verification step before exposing raw secrets.
router.get("/admin/secrets/raw", requireAdmin, async (req, res) => {
  try {
    const totpCode = req.headers["x-admin-totp-code"];
    if (!totpCode || typeof totpCode !== "string" || !/^\d{6}$/.test(totpCode)) {
      res.status(403).json({ ok: false, error: "totp_required", message: "TOTP code required in X-Admin-TOTP-Code header" });
      return;
    }
    const session = (req as any).adminSession;
    if (!session?.adminId) {
      res.status(403).json({ ok: false, error: "session_error", message: "Admin session lacks identity" });
      return;
    }
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId)).limit(1);
    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      res.status(403).json({ ok: false, error: "totp_not_configured", message: "2FA is not enabled for this admin" });
      return;
    }
    if (!verifyTotp(totpCode, admin.totpSecret)) {
      res.status(403).json({ ok: false, error: "invalid_totp", message: "Invalid TOTP code" });
      return;
    }
    const envVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      envVars[key] = value;
    }
    res.json({
      ok: true,
      secrets: envVars,
      count: Object.keys(envVars).length,
    });
  } catch (err) {
    logger.error({ err }, "Failed to list raw secrets");
    res.status(500).json({ ok: false, error: "Failed to list raw secrets" });
  }
});

// ── POST /api/admin/secrets/update — update a single secret ──
router.post("/admin/secrets/update", requireAdmin, async (req, res) => {
  try {
    const parsed = UpdateSecretSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.errors.map(e => e.message).join("; ") });
      return;
    }
    const { key, value } = parsed.data;

    // Safety: never allow overwriting NODE_ENV or critical system vars
    const PROTECTED_KEYS = ["NODE_ENV", "PATH", "HOME", "PWD", "SHELL", "TERM", "USER", "HOSTNAME"];
    if (PROTECTED_KEYS.includes(key.toUpperCase())) {
      res.status(403).json({ ok: false, error: `Cannot modify protected variable: ${key}` });
      return;
    }

    // Update in-memory process.env
    process.env[key] = value;

    logger.info({ key, adminId: (req as any).adminSession?.adminId }, "Admin updated environment variable");
    res.json({ ok: true, key, masked: maskValue(value, key) });
  } catch (err) {
    logger.error({ err }, "Failed to update secret");
    res.status(500).json({ ok: false, error: "Failed to update secret" });
  }
});

// ── POST /api/admin/secrets/bulk-update — update multiple secrets ──
router.post("/admin/secrets/bulk-update", requireAdmin, async (req, res) => {
  try {
    const parsed = BulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.errors.map(e => e.message).join("; ") });
      return;
    }
    const { secrets } = parsed.data;
    const PROTECTED_KEYS = ["NODE_ENV", "PATH", "HOME", "PWD", "SHELL", "TERM", "USER", "HOSTNAME"];

    const updated: string[] = [];
    const skipped: string[] = [];
    for (const [key, value] of Object.entries(secrets)) {
      if (PROTECTED_KEYS.includes(key.toUpperCase())) {
        skipped.push(key);
        continue;
      }
      process.env[key] = value;
      updated.push(key);
    }

    logger.info({ count: updated.length, adminId: (req as any).adminSession?.adminId }, "Admin bulk-updated environment variables");
    res.json({ ok: true, updated, skipped, count: updated.length });
  } catch (err) {
    logger.error({ err }, "Failed to bulk update secrets");
    res.status(500).json({ ok: false, error: "Failed to bulk update secrets" });
  }
});

export default router;
