import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { requireAdmin } from "../middlewares/adminAuth";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();

const AI_REF_LIMIT_MB = 10;
const AI_REF_LIMIT_BYTES = AI_REF_LIMIT_MB * 1024 * 1024;

/* ─── Rate limiting (per IP) ─── */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit = 20): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= limit) return false;
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

/* ══════════════════════════════════════════════════════
   IMAGE MODELS — free, no API key, auto-updated
   Pollinations.ai serves latest model versions automatically.
   Priority order: best quality first, speed fallbacks after.
══════════════════════════════════════════════════════ */
const IMAGE_MODELS = {
  "flux-realism": { label: "Flux Realism", desc: "Photorealistic, ultra-detailed" },
  "flux":         { label: "Flux",         desc: "Balanced quality & speed" },
  "flux-kontext": { label: "Flux Kontext", desc: "Best for image editing" },
  "flux-3d":      { label: "Flux 3D",      desc: "3D / product render style" },
  "any-dark":     { label: "Dark Art",     desc: "Dark dramatic illustrations" },
  "turbo":        { label: "Turbo",        desc: "Fastest generation" },
} as const;

type ImageModelId = keyof typeof IMAGE_MODELS;

/* ══════════════════════════════════════════════════════
   TEXT / CHAT MODELS — free, no API key
   Uses Pollinations text API (OpenAI-compatible endpoint).
══════════════════════════════════════════════════════ */
const TEXT_MODELS = [
  { id: "openai-large",  label: "GPT-4o (Recommended)" },
  { id: "openai",        label: "GPT-4o Mini" },
  { id: "mistral-large", label: "Mistral Large" },
  { id: "llama",         label: "Llama 3.3 70B" },
];

const POLLIN_TEXT_URL = "https://text.pollinations.ai/openai";

/* ════════════════════════════════════════════════════
   GET /api/ai/models
   Returns available models for the frontend.
════════════════════════════════════════════════════ */
router.get("/ai/models", (_req: Request, res: Response) => {
  return res.json({
    image: Object.entries(IMAGE_MODELS).map(([id, info]) => ({ id, ...info })),
    text: TEXT_MODELS,
  });
});

/* ════════════════════════════════════════════════════
   POST /api/ai/reference
   Upload a reference image for img2img editing.
   Returns a public URL for Pollinations to fetch.
════════════════════════════════════════════════════ */
router.post("/ai/reference", async (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!checkRateLimit(ip, 120)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const { image, ext: extHint } = req.body as { image?: string; ext?: string };
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image field (base64 data URL) is required" });
  }

  const dataUrlMatch = image.match(/^data:image\/([a-z]+);base64,(.+)$/);
  const base64Data = dataUrlMatch ? dataUrlMatch[2] : image;
  const detectedExt = dataUrlMatch ? dataUrlMatch[1].replace("jpeg", "jpg") : (extHint ?? "jpg");
  const safeExt = ["jpg", "png", "gif", "webp"].includes(detectedExt) ? detectedExt : "jpg";

  const buf = Buffer.from(base64Data, "base64");
  if (buf.length === 0) return res.status(400).json({ error: "Empty image data." });
  if (buf.length > AI_REF_LIMIT_BYTES) return res.status(413).json({ error: `Image must be under ${AI_REF_LIMIT_MB}MB.` });

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

/* ════════════════════════════════════════════════════
   GET /api/ai/ref/:filename
   Serve a previously uploaded AI reference image.
════════════════════════════════════════════════════ */
router.get("/ai/ref/:filename", (req: Request, res: Response) => {
  const rawFilename = req.params.filename;
  const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
  if (!filename || !/^ai-ref-[a-zA-Z0-9_-]+\.[a-z]+$/.test(filename)) {
    return res.status(400).json({ error: "Invalid filename." });
  }
  const filePath = path.join(getUploadsDir(), filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found." });
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.sendFile(filePath);
});

/* ════════════════════════════════════════════════════
   GET /api/ai/generate
   Server-side proxy for Pollinations image generation.
   Supports multi-model with automatic fallback chain.
   Query params:
     prompt    (required)
     model     (optional, default: flux-realism)
     seed      (optional)
     width     (optional, default: 1024)
     height    (optional, default: 1024)
     imageUrl  (optional) — reference image for img2img
════════════════════════════════════════════════════ */
router.get("/ai/generate", async (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!checkRateLimit(ip, 100)) {
    return res.status(429).json({ error: "Too many requests — please wait a moment." });
  }

  const {
    prompt,
    model = "flux-realism",
    seed,
    width = "1024",
    height = "1024",
    imageUrl,
    enhance = "true",
  } = req.query as Record<string, string>;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const finalSeed = seed || String(Math.floor(Math.random() * 999999));
  const w = Math.min(1440, Math.max(256, parseInt(width, 10) || 1024));
  const h = Math.min(1440, Math.max(256, parseInt(height, 10) || 1024));
  const safeModel = (model in IMAGE_MODELS) ? model as ImageModelId : "flux-realism";

  // Build fallback chain: requested model → flux-realism → flux → turbo
  const fallbackChain: ImageModelId[] = [safeModel];
  if (safeModel !== "flux-realism") fallbackChain.push("flux-realism");
  if (safeModel !== "flux") fallbackChain.push("flux");
  if (safeModel !== "turbo") fallbackChain.push("turbo");

  const buildUrl = (m: ImageModelId): string => {
    const base = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    const params = new URLSearchParams({
      width: String(w),
      height: String(h),
      seed: finalSeed,
      nologo: "true",
      model: m,
      ...(enhance === "true" ? { enhance: "true" } : {}),
    });
    if (imageUrl && typeof imageUrl === "string") {
      params.set("image_url", imageUrl);
    }
    return `${base}?${params.toString()}`;
  };

  let lastError = "Unknown error";
  for (const m of fallbackChain) {
    const url = buildUrl(m);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      const imgRes = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "TryNex-Studio/2.0" },
      });
      clearTimeout(timeout);

      if (!imgRes.ok) {
        lastError = `AI service returned ${imgRes.status}`;
        console.warn(`[ai/generate] model=${m} → ${imgRes.status}, trying next…`);
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
      return res.json({ dataUrl: `data:${mime};base64,${b64}`, model: m });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      console.warn(`[ai/generate] model=${m} fetch error:`, msg, "— trying next…");
      if (msg.includes("abort") || msg.includes("timeout")) {
        lastError = "AI generation timed out. Try a shorter prompt or faster model (Turbo).";
      }
    }
  }

  console.error("[ai/generate] All models failed. Last error:", lastError);
  return res.status(502).json({
    error: lastError.includes("timed out")
      ? lastError
      : "AI generation failed — the service may be busy. Try 'Turbo' model for faster results.",
  });
});

/* ════════════════════════════════════════════════════
   POST /api/storage/product-image
   Upload a product image — tries Imgur first (if
   IMGUR_CLIENT_ID is configured), then R2/S3, then local.
   Returns { url } for direct use as product imageUrl.
   Admin-only.
════════════════════════════════════════════════════ */
router.post("/storage/product-image", requireAdmin, async (req: Request, res: Response) => {
  const { image } = req.body as { image?: string };
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image field (base64 data URL) is required" });
  }

  const dataUrlMatch = image.match(/^data:image\/([a-z]+);base64,(.+)$/s);
  if (!dataUrlMatch) {
    return res.status(400).json({ error: "image must be a base64 data URL (data:image/...;base64,...)" });
  }
  const [, rawExt, b64] = dataUrlMatch;
  const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(rawExt) ? rawExt.replace("jpeg", "jpg") : "jpg";
  const mimeType = `image/${rawExt === "jpg" ? "jpeg" : rawExt}`;

  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0) return res.status(400).json({ error: "Empty image data." });
  if (buf.length > 20 * 1024 * 1024) return res.status(413).json({ error: "Image must be under 20 MB." });

  const imgurClientId = process.env.IMGUR_CLIENT_ID;
  if (imgurClientId) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const imgurRes = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Client-ID ${imgurClientId}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: b64, type: "base64", name: `product-${randomUUID()}.${safeExt}` }),
      });
      clearTimeout(timeout);
      if (imgurRes.ok) {
        const data = await imgurRes.json() as { data?: { link?: string }; success?: boolean };
        if (data?.success && data?.data?.link) {
          return res.json({ url: data.data.link, backend: "imgur" });
        }
      }
    } catch (e) {
      console.warn("[product-image] Imgur upload failed, falling back:", e instanceof Error ? e.message : e);
    }
  }

  const svc = new ObjectStorageService();
  const backend = svc.getBackendName();

  if (backend === "r2" || backend === "s3") {
    const entityId = `products/${randomUUID()}.${safeExt}`;
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2Key = process.env.R2_ACCESS_KEY_ID;
    const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
    const r2Bucket = process.env.R2_BUCKET;
    const r2PublicBase = process.env.R2_PUBLIC_BASE_URL;
    const s3Key = process.env.S3_ACCESS_KEY_ID;
    const s3Secret = process.env.S3_SECRET_ACCESS_KEY;
    const s3Bucket = process.env.S3_BUCKET;
    const s3PublicBase = process.env.S3_PUBLIC_BASE_URL;

    if (backend === "r2" && r2AccountId && r2Key && r2Secret && r2Bucket) {
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: r2Key, secretAccessKey: r2Secret },
        forcePathStyle: false,
      });
      await client.send(new PutObjectCommand({ Bucket: r2Bucket, Key: entityId, Body: buf, ContentType: mimeType }));
      const publicUrl = r2PublicBase ? `${r2PublicBase.replace(/\/$/, "")}/${entityId}` : `https://${r2AccountId}.r2.cloudflarestorage.com/${r2Bucket}/${entityId}`;
      return res.json({ url: publicUrl, backend: "r2" });
    }
    if (backend === "s3" && s3Key && s3Secret && s3Bucket) {
      const s3Region = process.env.S3_REGION || "us-east-1";
      const s3Endpoint = process.env.S3_ENDPOINT;
      const client = new S3Client({
        region: s3Region,
        endpoint: s3Endpoint,
        credentials: { accessKeyId: s3Key, secretAccessKey: s3Secret },
        forcePathStyle: !!process.env.S3_FORCE_PATH_STYLE,
      });
      await client.send(new PutObjectCommand({ Bucket: s3Bucket, Key: entityId, Body: buf, ContentType: mimeType }));
      const publicUrl = s3PublicBase ? `${s3PublicBase.replace(/\/$/, "")}/${entityId}` : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${entityId}`;
      return res.json({ url: publicUrl, backend: "s3" });
    }
  }

  const localDir = path.join(getUploadsDir(), "products");
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
  const filename = `product-${randomUUID()}.${safeExt}`;
  const filePath = path.join(localDir, filename);
  fs.writeFileSync(filePath, buf);
  const baseUrl = getPublicBaseUrl();
  return res.json({ url: `${baseUrl}/api/storage/product-images/${filename}`, backend: "local" });
});

router.get("/storage/product-images/:filename", (req: Request, res: Response) => {
  const rawFilename = req.params.filename;
  const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
  if (!filename || !/^product-[a-zA-Z0-9_-]+\.[a-z]+$/.test(filename)) {
    return res.status(400).json({ error: "Invalid filename." });
  }
  const filePath = path.join(getUploadsDir(), "products", filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found." });
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.sendFile(filePath);
});

/* ════════════════════════════════════════════════════
   POST /api/ai/chat
   Free AI chat using Pollinations text API.
   No API key needed. OpenAI-compatible format.

   Body:
     messages  (required) — array of { role, content }
     model     (optional, default: openai-large)
     system    (optional) — system prompt
     stream    (optional, default: false)
════════════════════════════════════════════════════ */
router.post("/ai/chat", async (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!checkRateLimit(ip, 120)) {
    return res.status(429).json({ error: "Too many requests — please wait a moment." });
  }

  const { messages, model = "openai-large", system } = req.body as {
    messages?: Array<{ role: string; content: string }>;
    model?: string;
    system?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const safeModel = TEXT_MODELS.some(m => m.id === model) ? model : "openai-large";

  const systemMessages = system
    ? [{ role: "system", content: system }]
    : [{
        role: "system",
        content: `You are an expert AI business assistant and store manager for TryNex Lifestyle — Bangladesh's premier custom apparel e-commerce brand (T-shirts, Hoodies, Mugs, Caps, Water Bottles).

Your expertise spans:
• E-commerce strategy & pricing (BDT currency, Bangladesh market dynamics)
• Marketing copy for Facebook, Instagram, WhatsApp & local platforms
• SEO-optimized blog posts & product descriptions (English + Bangla)
• Customer service scripts & order management responses
• Design trends for Bangladeshi audiences (Eid, Puja, cricket, youth culture)
• Promo code & discount strategy
• Supply chain & print-on-demand operations
• Analytics interpretation & growth tactics

Store context:
- Payment: bKash, Nagad, Rocket, COD (15% advance)
- Delivery: All 64 districts of Bangladesh
- Free shipping on orders ≥ ৳1,500
- Custom design via AI studio (Pollinations.ai) + upload + text tools
- Products: Custom T-shirts (320 GSM), Hoodies, Mugs, Caps, Long Sleeves, Water Bottles

Guidelines:
- Respond in the same language as the user (English or Bengali/Bangla)
- Use markdown headings (##, ###) and bullet points for structured content
- For pricing advice, suggest BDT amounts with market context
- Be data-driven — ask clarifying questions when needed for better recommendations
- For blog posts: 600-900 words, SEO-optimized, with meta description suggestion
- For ad copy: write 3 variations (short/medium/long) for A/B testing`,
      }];

  const allMessages = [...systemMessages, ...messages];
  const wantsStream = req.body.stream === true;

  if (wantsStream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const modelsToTry = [safeModel, ...TEXT_MODELS.filter(m => m.id !== safeModel).map(m => m.id)];
    for (const modelId of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90_000);
        const chatRes = await fetch(POLLIN_TEXT_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "User-Agent": "TryNex-Admin/2.0" },
          body: JSON.stringify({
            model: modelId,
            messages: allMessages,
            stream: true,
            seed: Math.floor(Math.random() * 99999),
            private: true,
          }),
        });
        clearTimeout(timeout);
        if (!chatRes.ok || !chatRes.body) {
          console.warn(`[ai/chat/stream] model=${modelId} → ${chatRes.status}, trying next`);
          continue;
        }
        sendEvent({ type: "model", model: modelId });
        const reader = chatRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") { sendEvent({ type: "done" }); res.end(); return; }
            try {
              const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string }> };
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) sendEvent({ type: "delta", delta });
              const finish = parsed?.choices?.[0]?.finish_reason;
              if (finish === "stop") { sendEvent({ type: "done" }); res.end(); return; }
            } catch { /* non-JSON line */ }
          }
        }
        sendEvent({ type: "done" });
        res.end();
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[ai/chat/stream] model=${modelId} error:`, msg, "— trying next");
        continue;
      }
    }
    sendEvent({ type: "error", error: "AI chat service is temporarily unavailable. Please try again." });
    res.end();
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const chatRes = await fetch(POLLIN_TEXT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TryNex-Admin/2.0",
      },
      body: JSON.stringify({
        model: safeModel,
        messages: allMessages,
        stream: false,
        seed: Math.floor(Math.random() * 99999),
        private: true,
      }),
    });
    clearTimeout(timeout);

    if (!chatRes.ok) {
      const txt = await chatRes.text().catch(() => "");
      console.warn("[ai/chat] model", safeModel, "returned", chatRes.status, txt.slice(0, 100), "— will try fallbacks");
      throw new Error(`Model ${safeModel} returned ${chatRes.status}`);
    }

    const data = await chatRes.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty response");

    return res.json({ content, model: safeModel });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("timeout")) {
      return res.status(504).json({ error: "AI chat timed out. Please try again." });
    }
    const modelIdx = TEXT_MODELS.findIndex(m => m.id === safeModel);
    const fallbacks = TEXT_MODELS.slice(modelIdx + 1);
    for (const fb of fallbacks) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45_000);
        const fbRes = await fetch(POLLIN_TEXT_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "User-Agent": "TryNex-Admin/2.0" },
          body: JSON.stringify({
            model: fb.id,
            messages: [...(system ? [{ role: "system", content: system }] : [{ role: "system", content: `You are a helpful AI assistant for TryNex Lifestyle — a premium custom apparel e-commerce brand in Bangladesh.` }]), ...messages],
            stream: false,
            seed: Math.floor(Math.random() * 99999),
            private: true,
          }),
        });
        clearTimeout(timeout);
        if (!fbRes.ok) continue;
        const fbData = await fbRes.json() as { choices?: Array<{ message?: { content?: string } }> };
        const fbContent = fbData?.choices?.[0]?.message?.content;
        if (!fbContent) continue;
        console.info("[ai/chat] fallback succeeded with", fb.id);
        return res.json({ content: fbContent, model: fb.id });
      } catch { continue; }
    }
    console.error("[ai/chat] all models failed:", msg);
    return res.status(502).json({ error: "AI chat service is temporarily unavailable. Please try again in a moment." });
  }
});

export default router;
