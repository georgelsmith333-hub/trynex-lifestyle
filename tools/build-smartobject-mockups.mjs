/**
 * TryNex smart-object mockup master builder.
 *
 * Produces real layered PSD masters in which the artwork layer is a genuine
 * Photoshop smart object: a `PlLd` placed-layer descriptor on the layer plus a
 * `lnk2` linked-file block carrying the embedded smart-object document.
 * Double-clicking "Artwork" in Photoshop opens the embedded document; editing
 * and saving it updates the mockup live.
 *
 * Usage:
 *   node tools/build-smartobject-mockups.mjs [--out dir] [--only family]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import { ColorMode, writePsdUint8Array } from "ag-psd";

const REPO = path.resolve(import.meta.dirname, "..");
const SOURCE_KIT = path.join(REPO, "attached_assets", "trynex-mockup-source-kit");
const SOURCE_PREVIEWS = path.join(SOURCE_KIT, "previews");
const SOURCE_MANIFEST = path.join(SOURCE_KIT, "manifest.json");

const CANVAS = 1024;
const BUILD_VERSION = "smart-v1.4";

/** The complete canonical matrix. Missing faces are explicitly derived below. */
export const CANONICAL = {
  tshirt: {
    label: "Unisex T-Shirt",
    colors: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
    views: {
      front: { zone: { x: 240, y: 185, w: 520, h: 580 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 240, y: 185, w: 520, h: 580 }, sourceView: "back", provenance: "authentic-preserved" },
      "left-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "left-sleeve-polygon" },
      "right-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "right-sleeve-polygon" },
      "neck-label": { zone: { x: 150, y: 265, w: 700, h: 470 }, sourceView: "front", provenance: "generated-master", derivation: "neck-label-crop" },
    },
  },
  longsleeve: {
    label: "Unisex Long Sleeve",
    colors: ["white", "black", "navy", "maroon", "olive", "grey", "red", "sky-blue", "burgundy", "forest"],
    views: {
      front: { zone: { x: 312, y: 222, w: 376, h: 404 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 292, y: 195, w: 416, h: 458 }, sourceView: "back", provenance: "authentic-preserved" },
      "left-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "left-sleeve-polygon" },
      "right-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "right-sleeve-polygon" },
      "neck-label": { zone: { x: 150, y: 265, w: 700, h: 470 }, sourceView: "front", provenance: "generated-master", derivation: "neck-label-crop" },
    },
  },
  hoodie: {
    label: "Unisex Hoodie",
    colors: ["white", "black", "navy", "grey", "maroon", "olive", "red", "sky-blue", "forest", "burgundy"],
    views: {
      front: { zone: { x: 240, y: 270, w: 520, h: 400 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 292, y: 184, w: 416, h: 448 }, sourceView: "back", provenance: "authentic-preserved" },
      "left-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "left-sleeve-polygon" },
      "right-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "right-sleeve-polygon" },
      "neck-label": { zone: { x: 150, y: 265, w: 700, h: 470 }, sourceView: "front", provenance: "generated-master", derivation: "neck-label-crop" },
    },
  },
  mug: {
    label: "Ceramic Mug",
    colors: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
    views: {
      front: { zone: { x: 165, y: 220, w: 475, h: 580 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 384, y: 220, w: 451, h: 580 }, sourceView: "back", provenance: "authentic-preserved" },
      wrap: { zone: { x: 165, y: 220, w: 670, h: 580 }, sourceView: "front", provenance: "generated-master", derivation: "mug-wrap-body-composite" },
    },
  },
  cap: {
    label: "Structured Cap",
    colors: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
    views: {
      front: { zone: { x: 240, y: 260, w: 540, h: 320 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 285, y: 270, w: 430, h: 230 }, sourceView: "back", provenance: "authentic-preserved" },
    },
  },
  waterbottle: {
    label: "Water Bottle - White Sublimation Aluminium",
    colors: ["white"],
    views: {
      front: { zone: { x: 335, y: 320, w: 276, h: 590 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 335, y: 320, w: 276, h: 590 }, sourceView: "back", provenance: "authentic-preserved" },
    },
  },
};

function readSourceManifest() {
  if (!existsSync(SOURCE_MANIFEST)) {
    throw new Error(`source manifest is missing: ${SOURCE_MANIFEST}`);
  }
  return JSON.parse(readFileSync(SOURCE_MANIFEST, "utf8"));
}

function normalizeSlug(value) {
  return String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function sourceSurface(family, color, view, manifest = readSourceManifest()) {
  const row = manifest.documents.find((entry) =>
    normalizeSlug(entry.product) === normalizeSlug(family) &&
    normalizeSlug(entry.color) === normalizeSlug(color) &&
    normalizeSlug(entry.view) === normalizeSlug(view)
  );
  if (!row) {
    throw new Error(`source manifest has no ${family}/${color}/${view} surface`);
  }
  return row;
}

function readPng(file) {
  const png = PNG.sync.read(readFileSync(file));
  return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height };
}

function pngBytes({ data, width, height }) {
  const png = new PNG({ width, height });
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(png.data);
  return PNG.sync.write(png);
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function copyPixel(source, target, sourceX, sourceY, targetX, targetY, alpha = 255) {
  if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) return;
  if (targetX < 0 || targetY < 0 || targetX >= target.width || targetY >= target.height) return;
  const si = (sourceY * source.width + sourceX) * 4;
  const ti = (targetY * target.width + targetX) * 4;
  const sourceAlpha = (source.data[si + 3] * alpha) / 255;
  const inverse = 1 - sourceAlpha / 255;
  target.data[ti] = Math.round(source.data[si] * sourceAlpha / 255 + target.data[ti] * inverse);
  target.data[ti + 1] = Math.round(source.data[si + 1] * sourceAlpha / 255 + target.data[ti + 1] * inverse);
  target.data[ti + 2] = Math.round(source.data[si + 2] * sourceAlpha / 255 + target.data[ti + 2] * inverse);
  target.data[ti + 3] = Math.min(255, Math.round(sourceAlpha + target.data[ti + 3] * inverse));
}

function transparentCanvas(width = CANVAS, height = CANVAS) {
  return solid(width, height, 0, 0, 0, 0);
}

function polygonContains(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Derive a missing canonical face from an immutable same-family source photo.
 * This is intentionally explicit: the manifest records the source face and
 * derivation, and no missing face is silently substituted as an authentic view.
 */
const COLOR_HEX = {
  white: "#f8f7f4", black: "#1a1a1a", navy: "#1e3a5f", maroon: "#7f1d1d",
  olive: "#4a5240", "sky-blue": "#0ea5e9", grey: "#6b7280", red: "#dc2626",
  burgundy: "#6b1a2c", forest: "#166534", green: "#16a34a", purple: "#7c3aed",
  pink: "#ec4899", orange: "#ea580c",
};

function colorizeTemplate(template, color, alphaMask) {
  const target = color === "white"
    ? [1, 1, 1]
    : (() => {
      const hex = COLOR_HEX[color];
      if (!hex) throw new Error(`no approved color transform for ${color}`);
      return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
    })();
  const data = new Uint8Array(template.data.length);
  for (let i = 0; i < template.data.length; i += 4) {
    const luminance = (0.2126 * template.data[i] + 0.7152 * template.data[i + 1] + 0.0722 * template.data[i + 2]) / 255;
    data[i] = color === "white" ? template.data[i] : Math.round(target[0] * luminance);
    data[i + 1] = color === "white" ? template.data[i + 1] : Math.round(target[1] * luminance);
    data[i + 2] = color === "white" ? template.data[i + 2] : Math.round(target[2] * luminance);
    data[i + 3] = Math.round(template.data[i + 3] * (alphaMask ? alphaMask.data[i] / 255 : 1));
  }
  return { data, width: template.width, height: template.height };
}

function clipFaceTemplateAlpha(alphaMask, family, view) {
  if (!alphaMask || view !== "neck-label") return alphaMask;
  const points = family === "tshirt"
    ? [[130, 280], [240, 235], [784, 235], [894, 280], [894, 790], [130, 790]]
    : family === "longsleeve"
      ? [[130, 560], [250, 455], [380, 430], [650, 430], [780, 455], [894, 560], [894, 780], [130, 780]]
      : [[140, 360], [260, 300], [760, 300], [880, 360], [880, 820], [140, 820]];
  const data = new Uint8Array(alphaMask.data);
  for (let y = 0; y < alphaMask.height; y++) {
    for (let x = 0; x < alphaMask.width; x++) {
      if (polygonContains(x, y, points)) continue;
      const i = (y * alphaMask.width + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return { data, width: alphaMask.width, height: alphaMask.height };
}

function deriveSurfaceBase({ family, color, view, source, sourceBack, faceTemplate, faceAlpha }) {
  if (faceTemplate) return colorizeTemplate(faceTemplate, color, clipFaceTemplateAlpha(faceAlpha, family, view));
  if (view === "front" || view === "back") return source;
  const out = transparentCanvas(source.width, source.height);
  const mirror = (x) => source.width - 1 - x;

  if (view === "left-sleeve" || view === "right-sleeve") {
    const points = family === "tshirt"
      ? [[0, 210], [270, 145], [390, 285], [285, 600], [150, 850], [0, 900]]
      : family === "longsleeve"
        ? [[0, 180], [300, 145], [365, 300], [285, 700], [160, 930], [0, 960]]
        : [[0, 170], [330, 110], [390, 325], [285, 760], [155, 970], [0, 980]];
    const selected = view === "left-sleeve" ? points : points.map(([x, y]) => [mirror(x), y]);
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        if (polygonContains(x, y, selected)) copyPixel(source, out, x, y);
      }
    }
  } else if (view === "neck-label") {
    const box = { x: 300, y: 35, w: 424, h: 285 };
    for (let y = box.y; y < box.y + box.h; y++) {
      for (let x = box.x; x < box.x + box.w; x++) copyPixel(source, out, x, y);
    }
  } else if (view === "wrap") {
    // A wrap is a distinct body derivation: blend the front body with the
    // mirrored back body to create a wider, seam-padded operator surface.
    const back = sourceBack ?? source;
    const body = { x: 150, y: 200, w: 700, h: 650 };
    for (let y = body.y; y < body.y + body.h; y++) {
      for (let x = body.x; x < body.x + body.w; x++) {
        const t = (x - body.x) / Math.max(1, body.w - 1);
        const sourceX = Math.round((x < body.x + body.w / 2 ? x : mirror(x)) * (source.width - 1) / Math.max(1, source.width - 1));
        const first = x < body.x + body.w / 2 ? source : back;
        const second = x < body.x + body.w / 2 ? back : source;
        const firstX = Math.max(0, Math.min(first.width - 1, sourceX));
        const secondX = Math.max(0, Math.min(second.width - 1, sourceX));
        copyPixel(first, out, firstX, y, x, y, Math.round(255 * (1 - t * 0.18)));
        copyPixel(second, out, secondX, y, x, y, Math.round(255 * (t * 0.18)));
      }
    }
  } else {
    throw new Error(`no approved derivation for ${family}/${view}`);
  }
  return out;
}

/** Solid RGBA canvas. */
function solid(w, h, r, g, b, a = 255) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  }
  return { data, width: w, height: h };
}

/** Visible proof artwork that can be edited inside the embedded Smart Object. */
function artworkProof(w, h, label = "TRY NEX") {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const onBorder = x < 6 || y < 6 || x >= w - 6 || y >= h - 6;
      const onCross = Math.abs(x - y) < 6 || Math.abs(x + y - (w - 1)) < 6;
      const stripe = Math.floor((x + y) / Math.max(1, Math.floor(w / 10))) % 2 === 0;
      if (onBorder || onCross || (stripe && x > w * 0.18 && x < w * 0.82 && y > h * 0.42 && y < h * 0.58)) {
        data[i] = 238; data[i + 1] = 84; data[i + 2] = 48; data[i + 3] = 230;
      } else {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
      }
    }
  }
  return { data, width: w, height: h };
}

/** Encode the embedded proof artwork as the editable linked-file payload. */
function soPngBytes({ data, width, height }) {
  const png = new PNG({ width, height });
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(png.data);
  return PNG.sync.write(png);
}

/** Stable GUID-like IDs keep the staging output reproducible across runs. */
function stableSoId(family, color, view) {
  const seed = `${family}:${color}:${view}:trynex-smart-object`;
  const hex = Array.from(seed).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 2166136261).toString(16).padStart(8, "0");
  const doubled = `${hex}${hex}${hex}${hex}`;
  return `${doubled.slice(0, 8)}-${doubled.slice(8, 12)}-${doubled.slice(12, 16)}-${doubled.slice(16, 20)}-${doubled.slice(20, 32)}`;
}

function shadowMap(base) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const luminance = 0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2];
    const alpha = Math.max(0, Math.min(72, Math.round((235 - luminance) * 0.55)));
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = alpha;
  }
  return { data, width: base.width, height: base.height };
}

function highlightMap(base) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const luminance = 0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2];
    const alpha = Math.max(0, Math.min(36, Math.round((luminance - 205) * 0.28)));
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = alpha;
  }
  return { data, width: base.width, height: base.height };
}

function flattenProof(base, proof, zone) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const alpha = base.data[i + 3] / 255;
    const inverse = 1 - alpha;
    data[i] = Math.round(base.data[i] * alpha + 250 * inverse);
    data[i + 1] = Math.round(base.data[i + 1] * alpha + 248 * inverse);
    data[i + 2] = Math.round(base.data[i + 2] * alpha + 245 * inverse);
    data[i + 3] = 255;
  }
  for (let y = 0; y < zone.h; y++) {
    const sourceY = Math.min(proof.height - 1, Math.floor(y * proof.height / zone.h));
    for (let x = 0; x < zone.w; x++) {
      const sourceX = Math.min(proof.width - 1, Math.floor(x * proof.width / zone.w));
      const destinationX = zone.x + x;
      const destinationY = zone.y + y;
      if (destinationX < 0 || destinationY < 0 || destinationX >= base.width || destinationY >= base.height) continue;
      const sourceIndex = (sourceY * proof.width + sourceX) * 4;
      const destinationIndex = (destinationY * base.width + destinationX) * 4;
      const alpha = proof.data[sourceIndex + 3] / 255;
      const inverse = 1 - alpha;
      data[destinationIndex] = Math.round(proof.data[sourceIndex] * alpha + data[destinationIndex] * inverse);
      data[destinationIndex + 1] = Math.round(proof.data[sourceIndex + 1] * alpha + data[destinationIndex + 1] * inverse);
      data[destinationIndex + 2] = Math.round(proof.data[sourceIndex + 2] * alpha + data[destinationIndex + 2] * inverse);
      data[destinationIndex + 3] = 255;
    }
  }
  return { data, width: base.width, height: base.height };
}

function flattenBase(base) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const alpha = base.data[i + 3] / 255;
    const inverse = 1 - alpha;
    data[i] = Math.round(base.data[i] * alpha + 250 * inverse);
    data[i + 1] = Math.round(base.data[i + 1] * alpha + 248 * inverse);
    data[i + 2] = Math.round(base.data[i + 2] * alpha + 245 * inverse);
    data[i + 3] = 255;
  }
  return { data, width: base.width, height: base.height };
}

/**
 * Build one layered PSD master with a real smart-object artwork layer.
 */
export function buildMaster({ family, color, view, zone, basePng, proofLabel = "TRY NEX" }) {
  const base = basePng ?? readPng(path.join(SOURCE_PREVIEWS, `${family}-${color}-${view}.png`));
  const soId = stableSoId(family, color, view);

  // Smart object content: a square artwork canvas matching the print zone's
  // larger dimension, so a pasted design keeps its aspect ratio.
  const soSize = Math.max(zone.w, zone.h);
  const soDoc = artworkProof(soSize, soSize, proofLabel);
  const soBytes = soPngBytes(soDoc);

  // Photoshop stores the four destination corners as x/y pairs.
  const transform = [
    zone.x, zone.y,
    zone.x + zone.w, zone.y,
    zone.x + zone.w, zone.y + zone.h,
    zone.x, zone.y + zone.h,
  ];

  const layers = [];
  const linkedFiles = [];

  // 1. Studio background (bottom)
  layers.push({
    name: "00 Studio Background - Warm White",
    imageData: solid(CANVAS, CANVAS, 250, 248, 245, 255),
  });

  // 2. Product photo (the blank garment)
  layers.push({
    name: `10 Product Base - ${family} - ${color} - ${view}`,
    imageData: base,
  });

  // 3. Source-derived fold/shadow response
  layers.push({
    name: "20 Shadow / Fold Map - multiply",
    blendMode: "multiply",
    opacity: 0.22,
    imageData: shadowMap(base),
  });

  // 4. ARTWORK - the real smart object
  layers.push({
    name: `30 Artwork - SMART OBJECT - ${family}-${color}-${view}`,
    imageData: soDoc,
    placedLayer: {
      id: soId,
      placed: `${soId}-placed`,
      type: "raster",
      transform,
      width: soSize,
      height: soSize,
      resolution: { units: "Density", value: 72 },
    },
  });

  // 5. Protected details remain a separate layer for future reviewed masks.
  layers.push({
    name: "40 Protected Details - source silhouette",
    imageData: solid(CANVAS, CANVAS, 0, 0, 0, 0),
  });

  // 6. Source-derived highlight response
  layers.push({
    name: "50 Highlight / Material Response - screen",
    blendMode: "screen",
    opacity: 0.18,
    imageData: highlightMap(base),
  });

  // 7. Hidden print-zone review layer
  layers.push({
    name: "60 Print Zone Mask - hidden review",
    hidden: true,
    imageData: zoneMask(zone),
  });

  // 8. Hidden placement guide
  layers.push({
    name: "70 Placement Guide - hidden review",
    hidden: true,
    imageData: zoneGuide(zone),
  });

  linkedFiles.push({
    id: soId,
    name: `${family}-${color}-${view}-artwork-proof.png`,
    type: "png ",
    creator: "TryNex",
    data: new Uint8Array(soBytes),
    time: "2026-09-01T00:00:00.000Z",
    descriptor: { compInfo: { compID: 0, originalCompID: 0 } },
  });

  return {
    psd: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      bitsPerChannel: 8,
      colorMode: ColorMode.RGB,
      imageData: flattenProof(base, soDoc, zone),
      children: layers,
      linkedFiles,
    },
    soId,
    proofDesign: soDoc,
    transform,
  };
}

/** Semi-transparent zone fill for a hidden review layer. */
function zoneMask(zone) {
  const data = new Uint8Array(CANVAS * CANVAS * 4);
  for (let y = Math.max(0, zone.y); y < Math.min(CANVAS, zone.y + zone.h); y++) {
    for (let x = Math.max(0, zone.x); x < Math.min(CANVAS, zone.x + zone.w); x++) {
      const i = (y * CANVAS + x) * 4;
      data[i] = 255;
      data[i + 1] = 140;
      data[i + 2] = 40;
      data[i + 3] = 28;
    }
  }
  return { data, width: CANVAS, height: CANVAS };
}

/** Dashed rectangle marking the print zone. */
function zoneGuide(zone) {
  const data = new Uint8Array(CANVAS * CANVAS * 4);
  const put = (x, y) => {
    if (x < 0 || y < 0 || x >= CANVAS || y >= CANVAS) return;
    const i = (y * CANVAS + x) * 4;
    data[i] = 255; data[i + 1] = 60; data[i + 2] = 20; data[i + 3] = 255;
  };
  const dash = 14;
  for (let x = zone.x; x < zone.x + zone.w; x++) {
    if (Math.floor(x / dash) % 2 === 0) { put(x, zone.y); put(x, zone.y + zone.h - 1); }
  }
  for (let y = zone.y; y < zone.y + zone.h; y++) {
    if (Math.floor(y / dash) % 2 === 0) { put(zone.x, y); put(zone.x + zone.w - 1, y); }
  }
  return { data, width: CANVAS, height: CANVAS };
}

function parseArgs(argv) {
  const get = (name, fallback = null) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  return {
    outRoot: path.resolve(get("--out", path.join(REPO, "dist-mockups", "staging", "smart-v1", "masters"))),
    stage1: argv.includes("--stage1"),
    only: get("--only"),
    resume: argv.includes("--resume"),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const { outRoot, stage1, only, resume } = parseArgs(argv);
  const sourceManifest = readSourceManifest();
  const stagingRoot = path.dirname(outRoot);
  const sourceRoot = path.join(stagingRoot, "sources");
  const templateRoot = path.join(stagingRoot, "templates");
  const previewRoot = path.join(stagingRoot, "previews");
  const proofPreviewRoot = path.join(stagingRoot, "proof-previews");

  let built = 0, failed = 0;
  for (const [family, spec] of Object.entries(CANONICAL)) {
    if (only && family !== only) continue;
    const famDir = path.join(outRoot, family);
    mkdirSync(famDir, { recursive: true });
    const surfaces = stage1 ? [["white", "front"]] : spec.colors.flatMap((color) => Object.keys(spec.views).map((view) => [color, view]));
    for (const [color, view] of surfaces) {
      try {
        const viewSpec = spec.views[view];
        const sourceView = viewSpec.sourceView;
        const source = sourceSurface(family, color, sourceView, sourceManifest);
        const sourceBackRow = view === "wrap" ? sourceSurface(family, color, "back", sourceManifest) : null;
        const basePath = path.join(SOURCE_KIT, source.preview);
        const backPath = sourceBackRow ? path.join(SOURCE_KIT, sourceBackRow.preview) : null;
        if (!existsSync(basePath)) throw new Error(`missing source preview ${source.preview}`);
        if (backPath && !existsSync(backPath)) throw new Error(`missing source preview ${sourceBackRow.preview}`);
        const sourceBytes = readFileSync(basePath);
        const sourcePng = readPng(basePath);
        const templatePath = view !== "front" && view !== "back" ? path.join(templateRoot, family, `${view}.png`) : null;
        const templateAlphaPath = view !== "front" && view !== "back" ? path.join(templateRoot, family, `${view}-alpha.png`) : null;
        const faceTemplate = templatePath && existsSync(templatePath) ? readPng(templatePath) : undefined;
        const faceTemplateChecksum = templatePath && existsSync(templatePath) ? sha256(readFileSync(templatePath)) : null;
        const faceAlpha = templateAlphaPath && existsSync(templateAlphaPath) ? readPng(templateAlphaPath) : undefined;
        const faceAlphaTemplateChecksum = templateAlphaPath && existsSync(templateAlphaPath) ? sha256(readFileSync(templateAlphaPath)) : null;
        const base = deriveSurfaceBase({
          family,
          color,
          view,
          source: sourcePng,
          sourceBack: backPath ? readPng(backPath) : undefined,
          faceTemplate,
          faceAlpha,
        });
        const baseBytes = pngBytes(base);
        const sourceChecksum = sha256(sourceBytes);
        const baseChecksum = sha256(baseBytes);
        const surfaceDir = path.join(sourceRoot, family, color);
        const previewDir = path.join(previewRoot, family, color);
        const proofDir = path.join(proofPreviewRoot, family, color);
        mkdirSync(surfaceDir, { recursive: true });
        mkdirSync(previewDir, { recursive: true });
        mkdirSync(proofDir, { recursive: true });
        const derivedBasePath = path.join(surfaceDir, `${view}.png`);
        const runtimePreviewPath = path.join(previewDir, `${view}.png`);
        const proofPath = path.join(proofDir, `${view}.png`);
        writeFileSync(derivedBasePath, baseBytes);
        const zone = viewSpec.zone;
        const outputPath = path.join(famDir, `${family}-${color}-${view}.psd`);
        const metadataPath = path.join(famDir, `${family}-${color}-${view}.json`);
        if (resume && existsSync(outputPath) && existsSync(metadataPath)) {
          try {
            const prior = JSON.parse(readFileSync(metadataPath, "utf8"));
            if (prior.schema === "trynex-smart-master/v3" && prior.generatorVersion === BUILD_VERSION && prior.sourceChecksum === sourceChecksum && prior.baseChecksum === baseChecksum && prior.faceTemplateChecksum === faceTemplateChecksum && prior.faceAlphaTemplateChecksum === faceAlphaTemplateChecksum && prior.derivation === (viewSpec.derivation ?? "preserved-source")) {
              console.log(`  = resume ${family}/${color}/${view}`);
              built++;
              continue;
            }
          } catch {
            // An unreadable or stale metadata file is rebuilt below.
          }
        }
        const { psd, transform } = buildMaster({
          family,
          color,
          view,
          zone,
          basePng: base,
          proofLabel: stage1 ? `STAGE 1 - ${family}` : "TRY NEX",
        });
        writeFileSync(outputPath, writePsdUint8Array(psd));
        writeFileSync(runtimePreviewPath, pngBytes(flattenBase(base)));
        writeFileSync(proofPath, pngBytes(psd.imageData));
        const masterBytes = readFileSync(outputPath);
        writeFileSync(metadataPath, JSON.stringify({
          schema: "trynex-smart-master/v3",
          generator: "tools/build-smartobject-mockups.mjs",
          generatorVersion: BUILD_VERSION,
          family, color, view,
          sourceView,
          sourcePreview: source.preview,
          sourceChecksum,
          sourceBackPreview: sourceBackRow?.preview ?? null,
          sourceBackChecksum: sourceBackRow ? sha256(readFileSync(backPath)) : null,
          faceTemplatePath: templatePath ? path.relative(REPO, templatePath) : null,
          faceTemplateChecksum,
          faceAlphaTemplatePath: templateAlphaPath ? path.relative(REPO, templateAlphaPath) : null,
          faceAlphaTemplateChecksum,
          derivedBasePath: path.relative(REPO, derivedBasePath),
          baseChecksum,
          printZone: zone,
          normalizedFrame: { canvasWidth: CANVAS, canvasHeight: CANVAS, x: 0, y: 0, w: CANVAS, h: CANVAS },
          derivation: viewSpec.derivation ?? "preserved-source",
          provenance: viewSpec.provenance,
          warp: family === "mug" || family === "waterbottle"
            ? { mode: "cylinder", curvature: 0.16, seamPadding: 0.035, preserveAspect: true }
            : family === "cap"
              ? { mode: "cap-panel", curvature: 0.10, seamPadding: 0.025, preserveAspect: true }
              : { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
          smartObject: {
            layerName: `30 Artwork - SMART OBJECT - ${family}-${color}-${view}`,
            id: psd.linkedFiles[0].id,
            placed: psd.children[3].placedLayer.placed,
            transform,
            proofDesign: "embedded-linked-file",
          },
          masterPath: path.relative(REPO, outputPath),
          masterChecksum: sha256(masterBytes),
          previewPath: path.relative(REPO, runtimePreviewPath),
          previewChecksum: sha256(readFileSync(runtimePreviewPath)),
          proofPreviewPath: path.relative(REPO, proofPath),
          proofPreviewChecksum: sha256(readFileSync(proofPath)),
          masterFormat: "psd",
          reviewStatus: "candidate",
        }, null, 2) + "\n");
        built++;
      } catch (err) {
        console.error(`  ! ${family}/${color}/${view}: ${err instanceof Error ? err.message : String(err)}`);
        failed++;
      }
    }
  }
  console.log(`built=${built} failed=${failed} -> ${outRoot}`);
  if (stage1 && built === 6 && failed === 0) {
    writeFileSync(
      path.join(path.dirname(outRoot), "stage1-representatives.json"),
      JSON.stringify({
        schema: "trynex-smart-mockup-stage1/v1",
        status: "candidate",
        generatedAt: "2026-09-01",
        representatives: Object.keys(CANONICAL).map((family) => ({
          family,
          color: "white",
          view: "front",
          master: path.relative(REPO, path.join(outRoot, family, `${family}-white-front.psd`)),
        })),
      }, null, 2) + "\n"
    );
  } else if (!stage1 && built === 188 && failed === 0) {
    const records = [];
    for (const [family, spec] of Object.entries(CANONICAL)) {
      for (const color of spec.colors) {
        for (const view of Object.keys(spec.views)) {
          records.push(JSON.parse(readFileSync(path.join(outRoot, family, `${family}-${color}-${view}.json`), "utf8")));
        }
      }
    }
    writeFileSync(path.join(stagingRoot, "manifest.json"), JSON.stringify({
      schema: "trynex-smart-mockup-staging/v2",
      status: "candidate",
      generatedAt: "2026-09-01",
      surfaceCount: records.length,
      canonicalSurfaceCount: 188,
      editableMastersOutsidePublic: true,
      waterbottleColors: ["white"],
      surfaces: records,
    }, null, 2) + "\n");
  }
  if (failed > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
