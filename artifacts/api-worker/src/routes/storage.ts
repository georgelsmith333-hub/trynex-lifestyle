import { Hono } from "hono";
import { requireAdmin } from "../middleware/adminAuth";
import { signStoragePath, verifyStorageSig } from "../lib/auth";
import { z } from "zod";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif":  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

const ALLOWED_TYPES = new Set(Object.keys(ALLOWED_IMAGE_TYPES));

function matchesMagicBytes(buf: Uint8Array, signatures: number[][]): boolean {
  return signatures.some((sig) => sig.every((byte, i) => buf[i] === byte));
}

function detectImageType(buf: Uint8Array): string | null {
  for (const [mimeType, sigs] of Object.entries(ALLOWED_IMAGE_TYPES)) {
    if (matchesMagicBytes(buf, sigs)) {
      if (mimeType === "image/webp") {
        if (buf.length >= 12) {
          const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
          if (webp === "WEBP") return mimeType;
        }
        continue;
      }
      return mimeType;
    }
  }
  return null;
}

function generateUUID(): string {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

app.post("/storage/uploads/request-url", async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({
      name: z.string().min(1).max(255),
      size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
      contentType: z.string().min(1).max(127).transform((v) => v.toLowerCase().split(";")[0].trim())
        .refine((v) => ALLOWED_TYPES.has(v), { message: "Unsupported content type. Only JPEG, PNG, GIF, and WebP images are allowed." }),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "validation_error", message: parsed.error.errors.map((e) => e.message).join("; ") }, 400);
    }
    const { name, size, contentType } = parsed.data;
    const objectId = generateUUID();
    const objectPath = `uploads/${objectId}`;
    const workerUrl = new URL(c.req.url);
    const uploadURL = `${workerUrl.protocol}//${workerUrl.host}/api/storage/upload-direct/${objectId}`;
    return c.json({
      uploadURL,
      objectPath,
      backend: "r2",
      metadata: { name, size, contentType },
    });
  } catch (err) {
    console.error("Error generating upload URL", err);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
});

app.put("/storage/upload-direct/:objectId", async (c) => {
  const objectId = c.req.param("objectId");
  if (!objectId || !/^[a-zA-Z0-9-]+$/.test(objectId)) {
    return c.json({ error: "Invalid object id" }, 400);
  }

  try {
    const bodyBuf = new Uint8Array(await c.req.arrayBuffer());

    if (bodyBuf.length === 0) return c.json({ error: "Empty upload" }, 400);
    if (bodyBuf.length > MAX_UPLOAD_BYTES) return c.json({ error: "Upload too large (max 25 MB)" }, 413);

    const detectedType = detectImageType(bodyBuf);
    if (!detectedType) {
      return c.json({ error: "Unsupported file type. Only JPEG, PNG, GIF, and WebP images are accepted." }, 415);
    }

    const rawDeclared = c.req.header("content-type") ?? "";
    const declaredType = rawDeclared.split(";")[0].trim().toLowerCase();
    if (declaredType && ALLOWED_TYPES.has(declaredType) && declaredType !== detectedType) {
      return c.json({ error: `Content-Type mismatch: declared "${declaredType}" but file is "${detectedType}". Upload was rejected.` }, 415);
    }

    const objectPath = `uploads/${objectId}`;
    await c.env.R2.put(objectPath, bodyBuf, {
      httpMetadata: { contentType: detectedType },
    });

    return c.json({ success: true, detectedType });
  } catch (err) {
    console.error("Local upload failed", err);
    return c.json({ error: "Upload failed" }, 500);
  }
});

app.get("/storage/public-objects/*", async (c) => {
  try {
    const url = new URL(c.req.url);
    const prefix = "/api/storage/public-objects/";
    const filePath = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
    const key = `public-objects/${filePath}`;
    const obj = await c.env.R2.get(key);
    if (!obj) return c.json({ error: "Object not found" }, 404);
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": obj.etag,
      },
    });
  } catch (err) {
    console.error("Error serving public object", err);
    return c.json({ error: "Failed to serve public object" }, 500);
  }
});

app.get("/storage/objects/*", async (c) => {
  try {
    const url = new URL(c.req.url);
    const prefix = "/api/storage/objects/";
    const wildcardPath = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
    const key = `objects/${wildcardPath}`;
    const obj = await c.env.R2.get(key);
    if (!obj) return c.json({ error: "Object not found" }, 404);
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("Error serving object", err);
    return c.json({ error: "Failed to serve object" }, 500);
  }
});

app.get("/storage/sign-download", requireAdmin, async (c) => {
  try {
    const p = c.req.query("path") || "";
    if (!p.startsWith("/objects/")) {
      return c.json({ error: "validation_error", message: "path must start with /objects/" }, 400);
    }
    const sigAndExpiry = await signStoragePath(p, 900, c.env.JWT_SECRET);
    const workerUrl = new URL(c.req.url);
    const url = `${workerUrl.protocol}//${workerUrl.host}/api/storage/serve?path=${encodeURIComponent(p)}&token=${encodeURIComponent(sigAndExpiry)}`;
    return c.json({ url, expiresInSeconds: 900 });
  } catch (err) {
    console.error("Error signing download URL", err);
    return c.json({ error: "Failed to sign download URL" }, 500);
  }
});

app.get("/storage/serve", async (c) => {
  try {
    const p = c.req.query("path") || "";
    const token = c.req.query("token") || "";
    if (!p || !token) return c.json({ error: "missing params" }, 400);
    const valid = await verifyStorageSig(p, token, c.env.JWT_SECRET);
    if (!valid) return c.json({ error: "invalid or expired download link" }, 403);

    const key = p.replace(/^\//, "");
    const obj = await c.env.R2.get(key);
    if (!obj) return c.json({ error: "Object not found" }, 404);

    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
        "Content-Disposition": `attachment`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Error serving signed download", err);
    return c.json({ error: "Failed to serve file" }, 500);
  }
});

export default app;
