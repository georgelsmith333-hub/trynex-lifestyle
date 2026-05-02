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
    console.error("[ai/reference] write error:", err);
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
  const { filename } = req.params;
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

export default router;
