import type { PrintZone } from "./mockups";

export type FitMode = "contain" | "cover";

export interface ImageFitResult {
  src: string;
  naturalW: number;
  naturalH: number;
  scale: number;
  crop: { x: number; y: number; w: number; h: number };
  trimmed: boolean;
}

const MAX_CANVAS_SIDE = 4096;
const ALPHA_THRESHOLD = 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Trims transparent PNG padding in-browser. Opaque photos keep their full
 * bounds, while logos exported with a large transparent canvas become the
 * actual visible mark before they are fitted to the product zone.
 */
export async function trimTransparentPadding(src: string): Promise<{
  src: string;
  naturalW: number;
  naturalH: number;
  trimmed: boolean;
}> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The uploaded image could not be decoded."));
  });
  try { await image.decode?.(); } catch { /* onload is sufficient in older browsers */ }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error("The uploaded image has no readable dimensions.");

  const scale = Math.min(1, MAX_CANVAS_SIDE / Math.max(width, height));
  const scanW = Math.max(1, Math.round(width * scale));
  const scanH = Math.max(1, Math.round(height * scale));
  const scan = document.createElement("canvas");
  scan.width = scanW;
  scan.height = scanH;
  const scanCtx = scan.getContext("2d", { willReadFrequently: true });
  if (!scanCtx) return { src, naturalW: width, naturalH: height, trimmed: false };
  scanCtx.clearRect(0, 0, scanW, scanH);
  scanCtx.drawImage(image, 0, 0, scanW, scanH);
  const pixels = scanCtx.getImageData(0, 0, scanW, scanH).data;

  let minX = scanW;
  let minY = scanH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < scanH; y++) {
    for (let x = 0; x < scanW; x++) {
      const alpha = pixels[(y * scanW + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Opaque images and fully transparent images should retain their source.
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === scanW - 1 && maxY === scanH - 1)) {
    return { src, naturalW: width, naturalH: height, trimmed: false };
  }

  const sourceX = Math.floor(minX / scale);
  const sourceY = Math.floor(minY / scale);
  const sourceW = Math.max(1, Math.ceil((maxX - minX + 1) / scale));
  const sourceH = Math.max(1, Math.ceil((maxY - minY + 1) / scale));
  const out = document.createElement("canvas");
  out.width = sourceW;
  out.height = sourceH;
  const ctx = out.getContext("2d");
  if (!ctx) return { src, naturalW: width, naturalH: height, trimmed: false };
  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
  return { src: out.toDataURL("image/png"), naturalW: sourceW, naturalH: sourceH, trimmed: true };
}

/** Compute a centered product-zone fit in the editor's 1000×1000 coordinate system. */
export function fitImageToPrintZone(
  naturalW: number,
  naturalH: number,
  zone: PrintZone,
  mode: FitMode = "contain",
  margin = 0.94,
): Pick<ImageFitResult, "scale" | "crop"> {
  const aspect = Math.max(naturalW, 1) / Math.max(naturalH, 1);
  const zoneAspect = zone.w / zone.h;

  let scale = 1;
  if (mode === "contain") {
    // Fits the entire image within the zone, keeping aspect ratio
    scale = aspect > zoneAspect ? (zone.w / naturalW) : (zone.h / naturalH);
  } else {
    // Covers the entire zone, potentially cropping the image
    scale = aspect > zoneAspect ? (zone.h / naturalH) : (zone.w / naturalW);
  }

  // Convert to DesignStudio scale (relative to zone.w)
  const designScale = (scale * naturalW) / zone.w;

  return {
    scale: clamp(designScale * margin, 0.05, 5),
    crop: { x: 0, y: 0, w: 100, h: 100 },
  };
}

export async function prepareImageForPrintZone(
  src: string,
  zone: PrintZone,
  mode: FitMode = "contain",
  margin = 0.94,
): Promise<ImageFitResult> {
  const trimmed = await trimTransparentPadding(src);
  const fit = fitImageToPrintZone(trimmed.naturalW, trimmed.naturalH, zone, mode, margin);
  return { ...trimmed, ...fit };
}
