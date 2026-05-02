import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { settingsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const SITE_URL = "https://trynexshop.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

async function getSetting(db: ReturnType<typeof createDb>, key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(db: ReturnType<typeof createDb>, key: string, value: string): Promise<void> {
  await db.insert(settingsTable).values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n|\r/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signJwt(serviceAccountEmail: string, privateKeyPem: string): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/webmasters",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowSec + 3600,
    iat: nowSec,
  }));
  const signingInput = `${header}.${payload}`;
  const keyBuffer = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sigBuffer)}`;
}

app.get("/admin/seo/status", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const lastPingAt = await getSetting(db, "seoLastGooglePingAt");
    const lastPingStatus = await getSetting(db, "seoLastGooglePingStatus");
    const gscServiceAccountConfigured = !!(await getSetting(db, "seoGscServiceAccountEmail"));
    return c.json({ sitemapUrl: SITEMAP_URL, lastPingAt, lastPingStatus, gscServiceAccountConfigured });
  } catch (err) {
    console.error("GET /admin/seo/status failed", err);
    return c.json({ message: "Failed to load SEO status" }, 500);
  }
});

app.post("/admin/seo/ping-google", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    let pingStatus: "ok" | "error" = "ok";
    let httpCode: number | null = null;
    let message = "";
    try {
      const pingRes = await fetch(pingUrl, { signal: AbortSignal.timeout(10000) });
      httpCode = pingRes.status;
      if (pingRes.ok) {
        message = `Google ping successful (HTTP ${httpCode})`;
      } else {
        pingStatus = "error";
        message = `Google ping returned HTTP ${httpCode}`;
      }
    } catch (fetchErr: any) {
      pingStatus = "error";
      message = fetchErr?.message?.includes("aborted")
        ? "Request timed out after 10s"
        : (fetchErr?.message ?? "Network error");
    }
    const now = new Date().toISOString();
    await setSetting(db, "seoLastGooglePingAt", now);
    await setSetting(db, "seoLastGooglePingStatus", pingStatus === "ok" ? `ok:${message}` : `error:${message}`);
    logActivity(db, { adminId: getAdminId(c), action: "update", entity: "setting", entityId: "sitemap", entityName: "Google Sitemap Ping", after: { status: pingStatus, httpCode, message } });
    return c.json({ success: pingStatus === "ok", message, httpCode, pingUrl, pingAt: now });
  } catch (err) {
    console.error("POST /admin/seo/ping-google failed", err);
    return c.json({ message: "Failed to ping Google" }, 500);
  }
});

app.post("/admin/seo/submit-gsc", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const serviceAccountEmail = await getSetting(db, "seoGscServiceAccountEmail");
    const serviceAccountKey = await getSetting(db, "seoGscServiceAccountKey");
    if (!serviceAccountEmail || !serviceAccountKey) {
      return c.json({ message: "Google Search Console service account not configured" }, 400);
    }
    let privateKey: string;
    try {
      const parsed = JSON.parse(serviceAccountKey);
      privateKey = parsed.private_key ?? serviceAccountKey;
    } catch {
      privateKey = serviceAccountKey;
    }
    let jwtToken: string;
    try {
      jwtToken = await signJwt(serviceAccountEmail, privateKey);
    } catch (keyErr: any) {
      return c.json({ message: `Failed to sign JWT with the stored private key: ${keyErr?.message ?? keyErr}` }, 500);
    }
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwtToken,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      return c.json({ message: `Failed to get Google access token: ${errBody}` }, 502);
    }
    const { access_token } = await tokenRes.json() as { access_token: string };
    const siteEncoded = encodeURIComponent(SITE_URL + "/");
    const submitRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${siteEncoded}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`,
      { method: "PUT", headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(15000) },
    );
    const submitOk = submitRes.ok;
    const submitStatus = submitRes.status;
    let submitMessage = submitOk
      ? "Sitemap successfully submitted to Google Search Console"
      : `Submission failed with HTTP ${submitStatus}`;
    if (!submitOk) {
      const body = await submitRes.text().catch(() => "");
      if (body) submitMessage += `: ${body.slice(0, 200)}`;
    }
    const submittedAt = new Date().toISOString();
    await setSetting(db, "seoLastGooglePingAt", submittedAt);
    await setSetting(db, "seoLastGooglePingStatus", submitOk ? `ok:${submitMessage}` : `error:${submitMessage}`);
    logActivity(db, { adminId: getAdminId(c), action: "update", entity: "setting", entityId: "sitemap", entityName: "Google Search Console Sitemap Submission", after: { success: submitOk, httpCode: submitStatus, message: submitMessage } });
    return c.json({ success: submitOk, message: submitMessage, httpCode: submitStatus, submittedAt });
  } catch (err: any) {
    console.error("POST /admin/seo/submit-gsc failed", err);
    return c.json({ message: err?.message ?? "Failed to submit sitemap to Google Search Console" }, 500);
  }
});

app.get("/admin/seo/gsc-config", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [emailRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountEmail")).limit(1);
    const [keyRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountKey")).limit(1);
    return c.json({
      configured: !!(emailRow?.value || keyRow?.value),
      serviceAccountEmail: emailRow?.value || null,
      hasKey: !!(keyRow?.value),
    });
  } catch (err) {
    console.error("GET /admin/seo/gsc-config failed", err);
    return c.json({ message: "Failed to get GSC config" }, 500);
  }
});

app.put("/admin/seo/gsc-config", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { serviceAccountEmail, serviceAccountJson } = body;

    if (serviceAccountEmail !== undefined) {
      await setSetting(db, "seoGscServiceAccountEmail", serviceAccountEmail.trim());
    }

    if (serviceAccountJson !== undefined) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        if (parsed.client_email && !serviceAccountEmail) {
          await setSetting(db, "seoGscServiceAccountEmail", parsed.client_email);
        }
        await setSetting(db, "seoGscServiceAccountKey", serviceAccountJson);
      } catch {
        return c.json({ message: "Invalid JSON for service account key" }, 400);
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("PUT /admin/seo/gsc-config failed", err);
    return c.json({ message: "Failed to save GSC config" }, 500);
  }
});

app.delete("/admin/seo/gsc-config", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    await db.delete(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountEmail"));
    await db.delete(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountKey"));
    return c.json({ success: true });
  } catch (err) {
    console.error("DELETE /admin/seo/gsc-config failed", err);
    return c.json({ message: "Failed to remove GSC config" }, 500);
  }
});

export default app;
