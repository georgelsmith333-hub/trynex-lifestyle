import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const router = Router();

const AI_REF_LIMIT_MB = 5;
const AI_REF_LIMIT_BYTES = AI_REF_LIMIT_MB * 1024 * 1024;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= 15) return false;
  bucket.count++;
  return true;
}

function getUploadsDir(): string {
  const dir = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getPublicBaseUrl(): string {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const port = process.env.PORT || process.env.API_PORT || "8080";
  return `http://localhost:${port}`;
}

/**
 * POST /api/ai/reference
 * Accepts a JSON body: { image: "<data URL or base64 string>", ext?: "jpg"|"png"|"webp" }
 * Saves the image to local storage and returns a publicly accessible URL
 * for use as the Pollinations image_url parameter (img2img editing).
 * Rate-limited to 15/minute per IP.
 */
router.post("/ai/reference", async (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const { image, ext: extHint } = req.body as { image?: string; ext?: string };
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image field (base64 data URL) is required" });
  }

  // Strip data URL prefix if present
  const dataUrlMatch = image.match(/^data:image\/([a-z]+);base64,(.+)$/);
  const base64Data = dataUrlMatch ? dataUrlMatch[2] : image;
  const detectedExt = dataUrlMatch ? dataUrlMatch[1].replace("jpeg", "jpg") : (extHint ?? "jpg");
  const safeExt = ["jpg", "png", "gif", "webp"].includes(detectedExt) ? detectedExt : "jpg";

  const buf = Buffer.from(base64Data, "base64");
  if (buf.length === 0) {
    return res.status(400).json({ error: "Empty image data." });
  }
  if (buf.length > AI_REF_LIMIT_BYTES) {
    return res.status(413).json({ error: `Image must be under ${AI_REF_LIMIT_MB}MB.` });
  }

  const filename = `ai-ref-${randomUUID()}.${safeExt}`;
  const filePath = path.join(getUploadsDir(), filename);

  try {
    fs.writeFileSync(filePath, buf);
  } catch (err) {
    console.error("[ai/reference] write error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Failed to save reference image." });
  }

  const url = `${getPublicBaseUrl()}/api/ai/ref/${filename}`;
  return res.json({ url });
});

/**
 * GET /api/ai/ref/:filename
 * Serves a previously uploaded AI reference image (public, CORS open).
 * Pollinations uses this URL to fetch the reference image for img2img.
 */
router.get("/ai/ref/:filename", (req: Request, res: Response) => {
  const rawFilename = req.params.filename;
  const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
  if (!filename || !/^ai-ref-[a-zA-Z0-9_-]+\.[a-z]+$/.test(filename)) {
    return res.status(400).json({ error: "Invalid filename." });
  }
  const filePath = path.join(getUploadsDir(), filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Not found." });
  }
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.sendFile(filePath);
});

/**
 * GET /api/ai/generate
 * Server-side proxy for Pollinations AI image generation.
 * Fetching from the server avoids browser CORS restrictions entirely.
 * Returns JSON: { dataUrl: "data:image/jpeg;base64,..." }
 *
 * Query params:
 *   prompt    (required) — image description
 *   seed      (optional) — numeric seed for reproducibility
 *   width     (optional, default 512)
 *   height    (optional, default 512)
 *   imageUrl  (optional) — public URL of reference image for img2img editing
 */
router.get("/ai/generate", async (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests — please wait a moment." });
  }

  const {
    prompt,
    seed,
    width = "512",
    height = "512",
    imageUrl,
  } = req.query as Record<string, string>;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const finalSeed = seed || String(Math.floor(Math.random() * 99999));
  const w = Math.min(1024, Math.max(256, parseInt(width, 10) || 512));
  const h = Math.min(1024, Math.max(256, parseInt(height, 10) || 512));

  // Build candidate URLs in priority order.
  // For img2img we try: flux-kontext (best quality) → flux (reliable fallback).
  // For text-to-image we use: flux (most reliable free model).
  const candidateUrls: string[] = [];
  if (imageUrl && typeof imageUrl === "string") {
    candidateUrls.push(
      [
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
        `?width=${w}&height=${h}&seed=${finalSeed}&nologo=true&model=kontext`,
        `&image_url=${encodeURIComponent(imageUrl)}`,
      ].join(""),
      [
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
        `?width=${w}&height=${h}&seed=${finalSeed}&nologo=true&model=flux`,
      ].join(""),
    );
  } else {
    candidateUrls.push(
      [
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
        `?width=${w}&height=${h}&seed=${finalSeed}&nologo=true&model=flux`,
      ].join(""),
    );
  }

  let lastError = "Unknown error";
  for (const pollinationsUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 75_000);
      const imgRes = await fetch(pollinationsUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "TryNex-AI-Proxy/1.0" },
      });
      clearTimeout(timeout);

      if (!imgRes.ok) {
        lastError = `AI service returned ${imgRes.status}`;
        console.warn(`[ai/generate] ${pollinationsUrl} → ${imgRes.status}, trying next…`);
        continue;
      }

      const buf = await imgRes.arrayBuffer();
      if (buf.byteLength < 512) {
        lastError = "AI returned an empty image";
        console.warn("[ai/generate] Empty image response, trying next…");
        continue;
      }
      const mime = imgRes.headers.get("content-type") || "image/jpeg";
      const b64 = Buffer.from(buf).toString("base64");
      return res.json({ dataUrl: `data:${mime};base64,${b64}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      console.warn("[ai/generate] fetch error:", msg, "— trying next candidate…");
      if (msg.includes("abort") || msg.includes("timeout")) {
        lastError = "AI generation timed out. Try a shorter/simpler prompt.";
      }
    }
  }

  console.error("[ai/generate] All candidates failed. Last error:", lastError);
  return res.status(502).json({ error: lastError.includes("timed out") ? lastError : "AI generation failed — the service may be busy. Please try again." });
});

export default router;
