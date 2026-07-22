/* ═══════════════════════════════════════════════════════
   COMPOSER — render a list of design layers onto a canvas
   Shared by:
     • realtime 3D preview  (CanvasTexture source)
     • add-to-cart snapshot (downloadable thumbnail)
════════════════════════════════════════════════════════ */

export interface ComposerTransform {
  x: number; y: number; scale: number; rotation: number; opacity: number;
  scaleX?: number; scaleY?: number;
}
export interface ComposerImageLayer {
  type: "image";
  visible: boolean;
  src: string;
  naturalW: number; naturalH: number;
  transform: ComposerTransform;
  flipH?: boolean;
  flipV?: boolean;
  brightness?: number;   // 0–200, default 100
  contrast?: number;     // 0–200, default 100
  saturation?: number;   // 0–200, default 100
}
export interface ComposerTextLayer {
  type: "text";
  visible: boolean;
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  color: string;
  transform: ComposerTransform;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;   // em units
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}
export type ComposerLayer = ComposerImageLayer | ComposerTextLayer;

export interface ComposerPrintZone { x: number; y: number; w: number; h: number; }

interface ComposeOptions {
  canvas: HTMLCanvasElement;
  baseHeight: number;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  garmentColor: string | null;
  outW: number;
  outH: number;
  imageCache?: Map<string, HTMLImageElement>;
  clipToPrintZone?: boolean;
  blendMode?: GlobalCompositeOperation;
  /** 0 = flat (apparel). >0 fakes a cylindrical/dome wrap for curved surfaces
   *  (mug, water bottle, cap) — edges compress horizontally, bow slightly
   *  vertically, and darken to mimic the surface curving away from camera.
   *  Typical values: 0.16 (mug/bottle side curve), 0.10 (cap dome). */
  curvature?: number;
}

const IMAGE_CACHE_MAX = 60;

export function loadImage(src: string, cache?: Map<string, HTMLImageElement>): Promise<HTMLImageElement> {
  if (cache?.has(src)) {
    const img = cache.get(src)!;
    if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cache) {
        if (cache.size >= IMAGE_CACHE_MAX) {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) cache.delete(firstKey);
        }
        cache.set(src, img);
      }
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function layerGeom(l: ComposerLayer, pz: ComposerPrintZone) {
  const cx = pz.x + pz.w / 2 + l.transform.x;
  const cy = pz.y + pz.h / 2 + l.transform.y;
  if (l.type === "image") {
    const aspect = l.naturalW / Math.max(l.naturalH, 1);
    const baseW = pz.w * l.transform.scale;
    const w = baseW * (l.transform.scaleX ?? 1);
    const h = (baseW / aspect) * (l.transform.scaleY ?? 1);
    return { cx, cy, w, h };
  }
  const w = (l.text.length * l.fontSize * 0.55) * l.transform.scale * (l.transform.scaleX ?? 1);
  const h = l.fontSize * 1.2 * l.transform.scale * (l.transform.scaleY ?? 1);
  return { cx, cy, w, h };
}

/** Build CSS filter string for image adjustments. Returns '' if no adjustments. */
function buildImageFilter(l: ComposerImageLayer): string {
  const br = l.brightness ?? 100;
  const co = l.contrast ?? 100;
  const sa = l.saturation ?? 100;
  if (br === 100 && co === 100 && sa === 100) return "";
  const parts: string[] = [];
  if (br !== 100) parts.push(`brightness(${br}%)`);
  if (co !== 100) parts.push(`contrast(${co}%)`);
  if (sa !== 100) parts.push(`saturate(${sa}%)`);
  return parts.join(" ");
}

/** Draw text with full stroke, shadow, letterSpacing, and textAlign support. */
function drawText(
  ctx: CanvasRenderingContext2D,
  l: ComposerTextLayer,
  fontSize: number,
  textX: number,
  textY: number,
  sx: number,
  sy: number,
) {
  const align = l.textAlign ?? "center";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  if (l.letterSpacing != null && l.letterSpacing !== 0) {
    (ctx as any).letterSpacing = `${l.letterSpacing * fontSize}px`;
  } else {
    (ctx as any).letterSpacing = "0px";
  }

  if (l.shadowBlur || l.shadowOffsetX || l.shadowOffsetY) {
    ctx.shadowColor = l.shadowColor ?? "rgba(0,0,0,0.5)";
    ctx.shadowBlur = (l.shadowBlur ?? 0) * Math.min(sx, sy);
    ctx.shadowOffsetX = (l.shadowOffsetX ?? 0) * sx;
    ctx.shadowOffsetY = (l.shadowOffsetY ?? 0) * sy;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  if (l.strokeWidth && l.strokeWidth > 0) {
    ctx.strokeStyle = l.strokeColor ?? "#000000";
    ctx.lineWidth = l.strokeWidth * l.transform.scale * Math.min(sx, sy);
    ctx.lineJoin = "round";
    ctx.strokeText(l.text, textX, textY);
  }

  ctx.fillStyle = l.color;
  ctx.fillText(l.text, textX, textY);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  (ctx as any).letterSpacing = "0px";
}

/** Get the X offset for a text alignment relative to the layer center. */
function textAlignOffset(align: "left" | "center" | "right", halfW: number): number {
  if (align === "left") return -halfW;
  if (align === "right") return halfW;
  return 0;
}

/** Draw an image warped to fake a cylindrical / dome surface curve.
 *  Simulates a round object photographed front-on: the centre faces the camera
 *  full-size, the edges pinch horizontally, recede vertically, and darken as
 *  they curve away from the light. A subtle centre highlight adds realism.
 *  Higher `quality` = more vertical strips for a smoother warp. */
function drawImageCurved(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  curvature: number,
) {
  const STRIPS = 80;
  const stripW = w / STRIPS;
  const curve = Math.max(0, curvature);
  const pinchStrength = Math.min(0.62, 0.34 + curve * 1.9);
  const bowStrength = 0.05 + curve * 0.22;
  const edgeShadeStrength = 1.1 + curve * 4.2;
  for (let i = 0; i < STRIPS; i++) {
    // u ranges -0.5 (left edge) .. 0 (centre) .. 0.5 (right edge)
    const u = (i + 0.5) / STRIPS - 0.5;
    const u2 = 2 * u; // -1..1
    const edgeFactor = Math.abs(u2); // 0..1
    const edgeCurve = Math.pow(edgeFactor, 1.85);

    // Cylindrical pinch: edge strips become narrower (foreshortening).
    const pinch = Math.pow(Math.cos(u2 * Math.PI / 2), 1.55);
    const renderStripW = stripW * (1 - pinchStrength * edgeCurve) * (0.98 + 0.02 * pinch);

    // Barrel bow: centre sits closest to camera; edges drop away.
    const bow = (1 - Math.cos((u2 * Math.PI) / 2)) * h * curve * bowStrength;

    // Edge darkening: surface curving away catches less light.
    const shade = 1 - Math.min(0.62, Math.pow(edgeFactor, 1.2) * edgeShadeStrength);

    // Source x keeps the original proportions; we take slightly wider source
    // strips at the edges so the compressed pixels still map correctly.
    const sx0 = (i / STRIPS) * img.naturalWidth;
    const sw = img.naturalWidth / STRIPS;
    const dx0 = -w / 2 + i * stripW + (stripW - renderStripW) * 0.5;

    ctx.save();
    ctx.filter = `brightness(${Math.max(0.36, shade) * 100}%)`;
    ctx.drawImage(
      img,
      sx0, 0, sw, img.naturalHeight,
      dx0, -h / 2 + bow, Math.max(0.4, renderStripW + 0.6), h,
    );
    ctx.restore();
  }

  // Soft vertical highlight down the centre — glossy ceramic/metal reflection.
  const grad = ctx.createLinearGradient(-w * 0.22, 0, w * 0.22, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.22)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = grad;
  ctx.fillRect(-w * 0.26, -h / 2, w * 0.52, h);
  ctx.restore();

  const edgeShade = ctx.createLinearGradient(-w / 2, 0, -w * 0.12, 0);
  edgeShade.addColorStop(0, "rgba(0,0,0,0.34)");
  edgeShade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = edgeShade;
  ctx.fillRect(-w / 2, -h / 2, w * 0.34, h);
  const edgeShadeR = ctx.createLinearGradient(w * 0.12, 0, w / 2, 0);
  edgeShadeR.addColorStop(0, "rgba(0,0,0,0)");
  edgeShadeR.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = edgeShadeR;
  ctx.fillRect(w * 0.16, -h / 2, w * 0.34, h);
  ctx.restore();
}

export async function composeLayers(opts: ComposeOptions): Promise<HTMLCanvasElement> {
  const {
    canvas, baseHeight, printZone, layers, garmentColor,
    outW, outH, imageCache, clipToPrintZone = true, blendMode = "multiply",
    curvature = 0,
  } = opts;
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const sx = outW / baseHeight;
  const sy = outH / baseHeight;

  ctx.clearRect(0, 0, outW, outH);
  if (garmentColor) {
    ctx.fillStyle = garmentColor;
    ctx.fillRect(0, 0, outW, outH);
  }

  if (clipToPrintZone) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(printZone.x * sx, printZone.y * sy, printZone.w * sx, printZone.h * sy);
    ctx.clip();
  }

  for (const l of layers) {
    if (!l.visible) continue;
    const g = layerGeom(l, printZone);
    ctx.save();
    ctx.translate(g.cx * sx, g.cy * sy);
    ctx.rotate((l.transform.rotation * Math.PI) / 180);
    ctx.globalAlpha = l.transform.opacity;

    if (l.type === "image") {
      try {
        const img = await loadImage(l.src, imageCache);
        ctx.globalCompositeOperation = "source-over";

        const cssFilter = buildImageFilter(l);
        if (cssFilter) ctx.filter = cssFilter;

        const flipSX = l.flipH ? -1 : 1;
        const flipSY = l.flipV ? -1 : 1;
        if (l.flipH || l.flipV) ctx.scale(flipSX, flipSY);

        const w = g.w * sx;
        const h = g.h * sy;
        if (curvature > 0) {
          drawImageCurved(ctx, img, w, h, curvature);
        } else {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }

        if (cssFilter) ctx.filter = "none";
      } catch (imgErr) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "rgba(239,68,68,0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(-(g.w * sx) / 2, -(g.h * sy) / 2, g.w * sx, g.h * sy);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(239,68,68,0.15)";
        ctx.fillRect(-(g.w * sx) / 2, -(g.h * sy) / 2, g.w * sx, g.h * sy);
        console.warn("[composer] Failed to load image layer:", (imgErr as Error)?.message ?? imgErr, l.src);
      }
    } else {
      ctx.globalCompositeOperation = blendMode;
      const fs = Math.round(l.fontSize * l.transform.scale * sy);
      ctx.font = `${l.fontStyle} ${l.fontWeight} ${fs}px ${l.fontFamily}`;

      const align = l.textAlign ?? "center";
      const xOffset = textAlignOffset(align, (g.w * sx) / 2);
      drawText(ctx, l, fs, xOffset, 0, sx, sy);
    }
    ctx.restore();
  }

  if (clipToPrintZone) ctx.restore();
  return canvas;
}

export async function composeGarmentMockup(opts: {
  canvas: HTMLCanvasElement;
  garmentSrc: string;
  garmentColor: string;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
  curvature?: number;
  /** Set true when garmentSrc is already the correct-colour photo — skips
   *  the SVG multiply-tint pass so the real photo is not double-tinted. */
  isColorPhoto?: boolean;
}): Promise<HTMLCanvasElement> {
  const { canvas, garmentSrc, garmentColor, printZone, layers, outSize, imageCache, curvature = 0, isColorPhoto = false } = opts;
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const s = outSize / 1000;

  ctx.clearRect(0, 0, outSize, outSize);

  try {
    const garmentImg = await loadImage(garmentSrc, imageCache);
    ctx.drawImage(garmentImg, 0, 0, outSize, outSize);

    // Skip multiply-tint when using a real per-colour photo — the photo already
    // carries the correct hue; multiplying the tint colour over it darkens it wrong.
    if (!isColorPhoto) {
      const r = parseInt(garmentColor.slice(1, 3), 16) || 0;
      const g = parseInt(garmentColor.slice(3, 5), 16) || 0;
      const b = parseInt(garmentColor.slice(5, 7), 16) || 0;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luminance < 0.92) {
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = garmentColor;
        ctx.fillRect(0, 0, outSize, outSize);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(garmentImg, 0, 0, outSize, outSize);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  } catch {
    ctx.fillStyle = garmentColor;
    ctx.beginPath();
    const rr = outSize * 0.06;
    const x = outSize * 0.12, y = outSize * 0.10, w = outSize * 0.76, h = outSize * 0.80;
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(printZone.x * s, printZone.y * s, printZone.w * s, printZone.h * s);
  ctx.clip();

  for (const layer of layers) {
    if (!layer.visible) continue;
    const geom = layerGeom(layer, printZone);
    const cx = geom.cx * s;
    const cy = geom.cy * s;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.globalAlpha = layer.transform.opacity;

    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src, imageCache);
        const w = geom.w * s;
        const h = geom.h * s;

        const cssFilter = buildImageFilter(layer);
        if (cssFilter) ctx.filter = cssFilter;

        const flipSX = layer.flipH ? -1 : 1;
        const flipSY = layer.flipV ? -1 : 1;
        if (layer.flipH || layer.flipV) ctx.scale(flipSX, flipSY);

        if (curvature > 0) {
          drawImageCurved(ctx, img, w, h, curvature);
        } else {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }
        if (cssFilter) ctx.filter = "none";
      } catch {}
    } else {
      const fs = Math.round(layer.fontSize * layer.transform.scale * s);
      ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${fs}px ${layer.fontFamily}`;
      const align = layer.textAlign ?? "center";
      const xOffset = textAlignOffset(align, (geom.w * s) / 2);
      // Use multiply blend for text only on light/white garments (lum > 0.92).
      // On dark/coloured garments (navy, maroon, grey, …) text must use source-over
      // so white and bright text colours are not swallowed by the garment tint.
      const gr = parseInt(garmentColor?.slice(1, 3) ?? "ff", 16);
      const gg = parseInt(garmentColor?.slice(3, 5) ?? "ff", 16);
      const gb = parseInt(garmentColor?.slice(5, 7) ?? "ff", 16);
      const glum = (0.299 * gr + 0.587 * gg + 0.114 * gb) / 255;
      const textBlend = glum > 0.92 ? "multiply" : "source-over";
      ctx.globalCompositeOperation = textBlend as GlobalCompositeOperation;
      drawText(ctx, layer, fs, xOffset, 0, s, s);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }

  ctx.restore();

  if (layers.some(l => l.visible)) {
    try {
      const garmentImg2 = await loadImage(garmentSrc, imageCache);
      ctx.save();
      ctx.beginPath();
      ctx.rect(printZone.x * s, printZone.y * s, printZone.w * s, printZone.h * s);
      ctx.clip();

      const isDarkGarment = garmentSrc.includes("black") || garmentSrc.includes("navy") || garmentSrc.includes("maroon") || garmentSrc.includes("forest") || garmentSrc.includes("burgundy");
      const isMidGarment = garmentSrc.includes("red") || garmentSrc.includes("olive") || garmentSrc.includes("grey") || garmentSrc.includes("skyblue") || garmentSrc.includes("teal") || garmentSrc.includes("pink");
      const isLightGarment = !isDarkGarment && !isMidGarment;

      if (isLightGarment) {
        // White/Light base photo: flat areas are near white (255).
        // Multiply darkens the design using the shadows/creases.
        // Pure white has no effect. Screen would cause white halos.
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.65;
        ctx.drawImage(garmentImg2, 0, 0, outSize, outSize);
        
        // Intensify shadows slightly with a darker multiply pass (linear-burn is not a
        // standard typed Canvas composite op, so we use color-burn for a similar effect).
        ctx.globalCompositeOperation = "color-burn";
        ctx.globalAlpha = 0.05;
        ctx.drawImage(garmentImg2, 0, 0, outSize, outSize);
      } else if (isDarkGarment) {
        // Dark/Black base photo: flat areas are near black (0-30).
        // Multiply would black out the design.
        // Screen lifts the design using the light highlights on the creases.
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.45;
        ctx.drawImage(garmentImg2, 0, 0, outSize, outSize);

        ctx.globalCompositeOperation = "color-dodge";
        ctx.globalAlpha = 0.15;
        ctx.drawImage(garmentImg2, 0, 0, outSize, outSize);
      } else {
        // Mid-tone base photo (Red, Grey, etc.)
        // Has both distinct shadows and highlights.
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.40;
        ctx.drawImage(garmentImg2, 0, 0, outSize, outSize);

        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.25;
        ctx.drawImage(garmentImg2, 0, 0, outSize, outSize);
        
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.15;
        ctx.drawImage(garmentImg2, 0, 0, outSize, outSize);
      }

      ctx.restore();
    } catch {}
  }

  return canvas;
}

export async function composeDesignTexture(opts: {
  canvas: HTMLCanvasElement;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
  clipToPrintZone?: boolean;
  curvature?: number;
}): Promise<HTMLCanvasElement> {
  const { canvas, printZone, layers, outSize, imageCache, clipToPrintZone = true, curvature = 0 } = opts;
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const s = outSize / 1000;

  ctx.clearRect(0, 0, outSize, outSize);

  if (clipToPrintZone) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(printZone.x * s, printZone.y * s, printZone.w * s, printZone.h * s);
    ctx.clip();
  }

  for (const layer of layers) {
    if (!layer.visible) continue;
    const geom = layerGeom(layer, printZone);
    const cx = geom.cx * s;
    const cy = geom.cy * s;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.globalAlpha = layer.transform.opacity;

    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src, imageCache);
        const w = geom.w * s;
        const h = geom.h * s;

        const cssFilter = buildImageFilter(layer);
        if (cssFilter) ctx.filter = cssFilter;

        const flipSX = layer.flipH ? -1 : 1;
        const flipSY = layer.flipV ? -1 : 1;
        if (layer.flipH || layer.flipV) ctx.scale(flipSX, flipSY);

        if (curvature > 0) {
          drawImageCurved(ctx, img, w, h, curvature);
        } else {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }
        if (cssFilter) ctx.filter = "none";
      } catch {}
    } else {
      const fs = Math.round(layer.fontSize * layer.transform.scale * s);
      ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${fs}px ${layer.fontFamily}`;
      const align = layer.textAlign ?? "center";
      const xOffset = textAlignOffset(align, (geom.w * s) / 2);
      drawText(ctx, layer, fs, xOffset, 0, s, s);
    }
    ctx.restore();
  }

  if (clipToPrintZone) ctx.restore();
  return canvas;
}

/** Analyse a small downscaled copy of the image and return suggested
 *  brightness / contrast corrections so logos/artwork pop on fabric.
 *  Returns the original src if no correction is needed. */
export async function autoFixImage(src: string): Promise<{ src: string; brightness: number; contrast: number }> {
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = src; });
  try { await img.decode?.(); } catch {}

  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { src, brightness: 100, contrast: 100 };

  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Compute average luminance and a simple contrast metric (std-dev-like).
  let sum = 0, sumSq = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = data[i + 3];
    if (a < 32) continue; // ignore transparent pixels
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum; sumSq += lum * lum; count++;
  }
  if (count === 0) return { src, brightness: 100, contrast: 100 };
  const avg = sum / count;
  const variance = sumSq / count - avg * avg;
  const std = Math.sqrt(Math.max(0, variance));

  // Target: average brightness ~ 128, contrast std ~ 60-80.
  let brightness = 100;
  let contrast = 100;
  if (avg < 100) brightness = Math.round(100 + (100 - avg) * 0.45);
  if (avg > 180) brightness = Math.round(100 - (avg - 180) * 0.45);
  if (std < 55) contrast = Math.round(100 + (55 - std) * 1.1);
  if (std > 90) contrast = Math.round(100 - (std - 90) * 0.6);

  brightness = Math.max(80, Math.min(140, brightness));
  contrast = Math.max(85, Math.min(140, contrast));

  if (brightness === 100 && contrast === 100) return { src, brightness, contrast };

  // Render corrected image at original size.
  const out = document.createElement("canvas");
  out.width = img.naturalWidth; out.height = img.naturalHeight;
  const octx = out.getContext("2d");
  if (!octx) return { src, brightness, contrast };
  octx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  octx.drawImage(img, 0, 0, out.width, out.height);
  return { src: out.toDataURL("image/png"), brightness, contrast };
}

export function hasWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}
