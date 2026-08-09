import { Router, type Request, type Response } from "express";
import sharp from "sharp";

const router = Router();
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_PIXELS = 4096 * 4096;

type Zone = { x: number; y: number; w: number; h: number };

function decodeImage(value: unknown): Buffer {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    throw new Error("image_must_be_data_url");
  }
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("invalid_data_url");
  const buffer = Buffer.from(value.slice(comma + 1), "base64");
  if (!buffer.length || buffer.length > MAX_INPUT_BYTES) throw new Error("image_too_large");
  return buffer;
}

function numberInRange(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function parseZone(value: unknown): Zone {
  if (!value || typeof value !== "object") throw new Error("zone_required");
  const z = value as Record<string, unknown>;
  const zone = {
    x: numberInRange(z.x, 0, 10000, 0),
    y: numberInRange(z.y, 0, 10000, 0),
    w: numberInRange(z.w, 1, 10000, 1),
    h: numberInRange(z.h, 1, 10000, 1),
  };
  return zone;
}

router.post("/api/mockup/render", async (req: Request, res: Response) => {
  try {
    const base = decodeImage(req.body?.baseImage);
    const artwork = decodeImage(req.body?.artwork);
    const zone = parseZone(req.body?.zone);
    const fit = req.body?.fit === "cover" ? "cover" : "contain";
    const opacity = numberInRange(req.body?.opacity, 0, 1, 1);
    const rotation = numberInRange(req.body?.rotation, -180, 180, 0);
    const brightness = numberInRange(req.body?.brightness, 0.4, 2.5, 1);
    const contrast = numberInRange(req.body?.contrast, 0.4, 2.5, 1);

    const baseImage = sharp(base, { limitInputPixels: MAX_OUTPUT_PIXELS });
    const baseMeta = await baseImage.metadata();
    const canvasW = baseMeta.width ?? 1000;
    const canvasH = baseMeta.height ?? 1000;
    const zoneW = Math.max(1, Math.min(canvasW, Math.round(zone.w)));
    const zoneH = Math.max(1, Math.min(canvasH, Math.round(zone.h)));

    const artMeta = await sharp(artwork, { limitInputPixels: MAX_OUTPUT_PIXELS }).metadata();
    const artW = artMeta.width ?? zoneW;
    const artH = artMeta.height ?? zoneH;
    const scale = fit === "cover"
      ? Math.max(zoneW / artW, zoneH / artH)
      : Math.min(zoneW / artW, zoneH / artH);
    const resizedW = Math.max(1, Math.round(artW * scale));
    const resizedH = Math.max(1, Math.round(artH * scale));
    const left = Math.round(numberInRange(zone.x, 0, canvasW - 1, 0) + (zoneW - resizedW) / 2);
    const top = Math.round(numberInRange(zone.y, 0, canvasH - 1, 0) + (zoneH - resizedH) / 2);

    let artworkLayer = sharp(artwork, { limitInputPixels: MAX_OUTPUT_PIXELS })
      .resize(resizedW, resizedH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .modulate({ brightness })
      .linear(contrast, 128 - 128 * contrast)
      .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .composite([])
      .png();

    let renderedArtwork = await artworkLayer.toBuffer();
    if (opacity < 1) {
      const renderedMeta = await sharp(renderedArtwork).metadata();
      const alpha = Buffer.alloc((renderedMeta.width ?? resizedW) * (renderedMeta.height ?? resizedH), Math.round(opacity * 255));
      renderedArtwork = await sharp(renderedArtwork)
        .removeAlpha()
        .joinChannel(alpha, { raw: { width: renderedMeta.width ?? resizedW, height: renderedMeta.height ?? resizedH, channels: 1 } })
        .png()
        .toBuffer();
    }

    const maskValue = req.body?.mask;
    const composites: sharp.OverlayOptions[] = [{ input: renderedArtwork, left, top }];
    if (typeof maskValue === "string" && maskValue.startsWith("data:image/")) {
      const mask = await sharp(decodeImage(maskValue))
        .resize(resizedW, resizedH, { fit: "fill" })
        .greyscale()
        .png()
        .toBuffer();
      composites[0].input = await sharp(renderedArtwork).removeAlpha().joinChannel(mask).png().toBuffer();
    }

    const textureValue = req.body?.texture;
    if (typeof textureValue === "string" && textureValue.startsWith("data:image/")) {
      composites.push({ input: await sharp(decodeImage(textureValue)).resize(canvasW, canvasH, { fit: "fill" }).ensureAlpha().png().toBuffer(), left: 0, top: 0, blend: "multiply", opacity: 0.22 });
    }

    const output = await baseImage.composite(composites).webp({ quality: 90 }).toBuffer();
    res.setHeader("Cache-Control", "private, max-age=60");
    res.type("image/webp").send(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : "render_failed";
    const status = ["image_must_be_data_url", "invalid_data_url", "image_too_large", "zone_required"].includes(message) ? 400 : 422;
    req.log.warn({ err: error }, "Mockup render failed");
    res.status(status).json({ error: "mockup_render_failed", message });
  }
});

export default router;
