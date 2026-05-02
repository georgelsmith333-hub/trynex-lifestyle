import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { settingsTable } from "../schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const MAX_CALLS = 10;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_CALLS) return false;
  bucket.count++;
  return true;
}

app.get("/remove-bg/status", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "removeBgApiKey"));
    return c.json({ configured: Boolean(row?.value) });
  } catch {
    return c.json({ configured: false });
  }
});

app.post("/remove-bg", async (c) => {
  try {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return c.json({
        error: "rate_limited",
        message: "Too many background removal requests. Please wait before trying again.",
      }, 429);
    }

    const body = await c.req.json();
    const { image } = body;
    if (!image || typeof image !== "string") {
      return c.json({ error: "image_required", message: "image field (base64 data URL) is required" }, 400);
    }

    if (image.length > MAX_PAYLOAD_BYTES) {
      return c.json({
        error: "image_too_large",
        message: "Image exceeds the 10 MB limit. Try HD-Upscale after resizing the image first.",
      }, 413);
    }

    const db = createDb(c.env.DATABASE_URL);
    const [apiKeyRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "removeBgApiKey"));
    const apiKey = apiKeyRow?.value;

    if (!apiKey) {
      return c.json({
        error: "no_api_key",
        message: "Background removal isn't configured — admin needs to add a remove.bg key.",
      }, 503);
    }

    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");
    const mimeType = image.startsWith("data:image/png") ? "image/png" : "image/jpeg";

    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const formData = new FormData();
    const blob = new Blob([bytes], { type: mimeType });
    formData.append("image_file", blob, "image.png");
    formData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("remove.bg API error", response.status, errorText);
      if (response.status === 402) {
        return c.json({
          error: "quota_exceeded",
          message: "Remove.bg quota exhausted. Please upgrade the remove.bg plan or wait until next month.",
        }, 402);
      }
      return c.json({ error: "remove_bg_failed", message: "Background removal failed on the server. Please try again." }, 502);
    }

    const resultBuffer = await response.arrayBuffer();
    const resultBytes = new Uint8Array(resultBuffer);
    let binary = "";
    for (const b of resultBytes) binary += String.fromCharCode(b);
    const resultBase64 = `data:image/png;base64,${btoa(binary)}`;
    return c.json({ result: resultBase64 });
  } catch (err) {
    console.error("remove-bg error", err);
    return c.json({ error: "internal_error", message: "Failed to remove background — please try again." }, 500);
  }
});

export default app;
