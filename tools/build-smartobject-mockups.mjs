/**
 * TryNex smart-object mockup master builder.
 *
 * Produces real layered PSD *and* PSB masters in which the artwork layer is a
 * genuine Photoshop smart object: a `PlLd` placed-layer descriptor on the layer
 * plus a `lnk2` linked-file block carrying the embedded smart-object document.
 * Double-clicking "Artwork" in Photoshop opens the embedded document; editing
 * and saving it updates the mockup live.
 *
 * Canvas is 2048×2048. Print zones are authored on the 1024 source-kit
 * photography and scaled by CANVAS/NATIVE.
 *
 * Usage:
 *   node tools/build-smartobject-mockups.mjs [--out dir] [--only family]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { writePsdUint8Array } from "ag-psd";

const REPO = path.resolve(import.meta.dirname, "..");
const BASE_DIR = path.join(REPO, "dist-mockups", "_work", "base");
const BASE_DIR_2048 = path.join(REPO, "dist-mockups", "_work", "surfaces-2048");
const DISPLACE_DIR = path.join(REPO, "dist-mockups", "_work", "displace");

export const NATIVE = 1024;
export const CANVAS = 2048;

const z = (x, y, w, h) => ({ x, y, w, h });

/** Canonical 188-surface matrix. Zones are on the 1024 native canvas. */
export const CANONICAL = {
  tshirt: {
    label: "Unisex T-Shirt",
    colors: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
    views: {
      front: { zone: z(240, 185, 520, 580) },
      back: { zone: z(240, 185, 520, 580) },
      "left-sleeve": { zone: z(175, 175, 650, 650) },
      "right-sleeve": { zone: z(175, 175, 650, 650) },
      "neck-label": { zone: z(150, 265, 700, 470) },
    },
  },
  longsleeve: {
    label: "Unisex Long Sleeve",
    colors: ["white", "black", "navy", "maroon", "olive", "grey", "red", "sky-blue", "burgundy", "forest"],
    views: {
      front: { zone: z(312, 222, 376, 404) },
      back: { zone: z(292, 195, 416, 458) },
      "left-sleeve": { zone: z(175, 175, 650, 650) },
      "right-sleeve": { zone: z(175, 175, 650, 650) },
      "neck-label": { zone: z(150, 265, 700, 470) },
    },
  },
  hoodie: {
    label: "Unisex Hoodie",
    colors: ["white", "black", "navy", "grey", "maroon", "olive", "red", "sky-blue", "forest", "burgundy"],
    views: {
      front: { zone: z(240, 270, 520, 400) },
      back: { zone: z(292, 184, 416, 448) },
      "left-sleeve": { zone: z(175, 175, 650, 650) },
      "right-sleeve": { zone: z(175, 175, 650, 650) },
      "neck-label": { zone: z(150, 265, 700, 470) },
    },
  },
  mug: {
    label: "Ceramic Mug",
    colors: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
    views: {
      front: { zone: z(165, 220, 475, 580) },
      back: { zone: z(384, 220, 451, 580) },
      wrap: { zone: z(165, 220, 670, 580) },
    },
  },
  cap: {
    label: "Structured Cap",
    colors: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
    views: {
      front: { zone: z(240, 260, 540, 320) },
      back: { zone: z(285, 270, 430, 230) },
    },
  },
  waterbottle: {
    label: "Water Bottle - White Sublimation Aluminium",
    colors: ["white"],
    views: {
      front: { zone: z(335, 320, 276, 590) },
      back: { zone: z(335, 320, 276, 590) },
    },
  },
};

export function countCanonical() {
  let n = 0;
  for (const spec of Object.values(CANONICAL)) n += spec.colors.length * Object.keys(spec.views).length;
  return n;
}

export function scaleZone(zone, canvas = CANVAS, native = NATIVE) {
  const s = canvas / native;
  return {
    x: Math.round(zone.x * s),
    y: Math.round(zone.y * s),
    w: Math.round(zone.w * s),
    h: Math.round(zone.h * s),
  };
}

function readPng(file) {
  try {
    const png = PNG.sync.read(readFileSync(file));
    return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height };
  } catch (err) {
    err.message = `${file}: ${err.message}`;
    throw err;
  }
}

function resizeNearest(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const data = new Uint8Array(w * h * 4);
  const srcCh = img.data.length / (img.width * img.height); // 3 or 4
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y * img.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / w));
      const si = (sy * img.width + sx) * srcCh;
      const di = (y * w + x) * 4;
      data[di] = img.data[si];
      data[di + 1] = img.data[si + 1];
      data[di + 2] = img.data[si + 2];
      data[di + 3] = srcCh === 4 ? img.data[si + 3] : 255;
    }
  }
  return { data, width: w, height: h };
}

function loadSurface(family, color, view) {
  const name = `${family}__${color}__${view}.png`;
  const candidates = [path.join(BASE_DIR_2048, name), path.join(BASE_DIR, name)];
  for (const file of candidates) {
    if (!existsSync(file) || !readFileSync(file).length) continue;
    try {
      return resizeNearest(readPng(file), CANVAS, CANVAS);
    } catch (err) {
      console.error(`  ! skip unreadable ${file}: ${err.message}`);
    }
  }
  return null;
}

/** Solid RGBA canvas. */
function solid(w, h, r, g, b, a = 255) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  }
  return { data, width: w, height: h };
}

/** Large placeholder artwork so the smart object is obviously editable. */
function artworkPlaceholder(w, h) {
  const data = new Uint8Array(w * h * 4);
  const border = Math.max(4, Math.round(w / 170));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const onBorder = x < border || y < border || x >= w - border || y >= h - border;
      const onCross = Math.abs(x - y) < border || Math.abs(x + y - w) < border;
      if (onBorder || onCross) {
        data[i] = 255; data[i + 1] = 90; data[i + 2] = 30; data[i + 3] = 255;
      } else {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
      }
    }
  }
  return { data, width: w, height: h };
}

function soPngBytes({ data, width, height }) {
  const png = new PNG({ width, height });
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(png.data);
  return PNG.sync.write(png);
}

const hex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

/** Photoshop requires placed-layer IDs in GUID form: 8-4-4-4-12. */
const nextSoId = () => `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;

/**
 * Build one layered PSD master with a real smart-object artwork layer.
 * `zone` must already be scaled to CANVAS.
 */
export function buildMaster({ family, color, view, zone, basePng, displacePng }) {
  const base = basePng ?? loadSurface(family, color, view);
  const soId = nextSoId();

  // Keep the embedded smart-object document at 1024 so the payload stays
  // editable without ballooning the master; the transform maps it onto the
  // 2048 print zone.
  const soSize = 1024;
  const soDoc = artworkPlaceholder(soSize, soSize);
  const soBytes = soPngBytes(soDoc);
  const transform = [zone.w, 0, 0, zone.h, zone.x, zone.y];

  const layers = [];
  const linkedFiles = [];

  layers.push({
    name: "Studio Background - Warm White",
    imageData: solid(CANVAS, CANVAS, 250, 248, 245, 255),
  });

  layers.push({
    name: `Product Photo - ${color} - ${view}`,
    imageData: resizeNearest(base, CANVAS, CANVAS),
  });

  // Displacement lives in a sidecar document (Filter > Distort > Displace
  // cannot read an embedded layer). A hidden reference copy at 2048 would
  // nearly double every master, so it is omitted on purpose.

  layers.push({
    name: "ARTWORK - double-click to edit your design",
    imageData: soDoc,
    placedLayer: {
      id: soId,
      placed: `${soId}.png`,
      type: "raster",
      transform,
      width: soSize,
      height: soSize,
      resolution: { units: "Density", value: 72 },
    },
  });

  layers.push({
    name: "Print Zone Guide - toggle visibility",
    hidden: true,
    imageData: zoneGuide(zone),
  });

  linkedFiles.push({
    id: soId,
    name: `${soId}.png`,
    type: "png ",
    creator: "TryNex",
    data: new Uint8Array(soBytes),
    time: new Date().toISOString(),
    descriptor: { compInfo: { compID: 0, originalCompID: 0 } },
  });

  return {
    psd: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      bitsPerChannel: 8,
      colorMode: ColorMode_RGB,
      children: layers,
      linkedFiles,
      imageResources: {},
    },
    soId,
  };
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

const ColorMode_RGB = 3;

function writeBoth(fileStem, psd) {
  writeFileSync(`${fileStem}.psd`, writePsdUint8Array(psd));
  writeFileSync(`${fileStem}.psb`, writePsdUint8Array(psd, { psb: true }));
}

function main() {
  const argv = process.argv.slice(2);
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
  const outIdx = argv.indexOf("--out");
  const outRoot = path.resolve(outIdx >= 0 ? argv[outIdx + 1] : path.join(REPO, "dist-mockups", "masters"));

  const expected = countCanonical();
  if (expected !== 188) {
    console.error(`canonical matrix is ${expected}, expected 188`);
    process.exit(2);
  }

  let built = 0, failed = 0;
  for (const [family, spec] of Object.entries(CANONICAL)) {
    if (only && family !== only) continue;
    const famDir = path.join(outRoot, family);
    mkdirSync(famDir, { recursive: true });
    for (const color of spec.colors) {
      for (const [view, vspec] of Object.entries(spec.views)) {
        const stem = path.join(famDir, `${family}-${color}-${view}`);
        if (existsSync(`${stem}.psd`) && existsSync(`${stem}.psb`)) {
          built++;
          continue;
        }
        const basePng = loadSurface(family, color, view);
        if (!basePng) { console.error(`  ! missing base: ${family}/${color}/${view}`); failed++; continue; }
        const dispName = `${family}__${color}__${view}.png`;
        const dispPath = path.join(DISPLACE_DIR, dispName);
        try {
          const zone = scaleZone(vspec.zone);
          const { psd } = buildMaster({ family, color, view, zone, basePng });
          writeBoth(stem, psd);

          if (existsSync(dispPath)) {
            const disp = resizeNearest(readPng(dispPath), CANVAS, CANVAS);
            // Displace filter reads a PSD document; PSB is not required here.
            writeFileSync(
              path.join(famDir, `${family}-${color}-${view}-DISPLACEMENT.psd`),
              writePsdUint8Array({
                width: CANVAS, height: CANVAS, channels: 3, bitsPerChannel: 8,
                colorMode: ColorMode_RGB,
                children: [{ name: "Displacement Map", imageData: disp }],
              }),
            );
          }
          built++;
          if (built % 20 === 0) console.log(`  … ${built}/${only ? "?" : expected}`);
        } catch (err) {
          console.error(`  ! ${family}/${color}/${view}: ${err.message}`);
          failed++;
        }
      }
    }
  }
  console.log(`built=${built} failed=${failed} canvas=${CANVAS} formats=psd,psb -> ${outRoot}`);
  if (!only && built !== 188) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
