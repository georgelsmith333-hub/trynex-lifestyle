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

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { writePsdUint8Array } from "ag-psd";

const REPO = path.resolve(import.meta.dirname, "..");
const BASE_DIR = path.join(REPO, "dist-mockups", "_work", "base");
const DISPLACE_DIR = path.join(REPO, "dist-mockups", "_work", "displace");

const CANVAS = 1024;

/** Canonical surfaces that have real base imagery. */
export const CANONICAL = {
  tshirt: {
    label: "Unisex T-Shirt",
    colors: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
    views: {
      front: { zone: { x: 240, y: 185, w: 520, h: 580 } },
      back: { zone: { x: 240, y: 185, w: 520, h: 580 } },
    },
  },
  longsleeve: {
    label: "Unisex Long Sleeve",
    colors: ["white", "black", "navy", "maroon", "olive", "grey", "red", "sky-blue", "burgundy", "forest"],
    views: {
      front: { zone: { x: 312, y: 222, w: 376, h: 404 } },
      back: { zone: { x: 292, y: 195, w: 416, h: 458 } },
    },
  },
  hoodie: {
    label: "Unisex Hoodie",
    colors: ["white", "black", "navy", "grey", "maroon", "olive", "red", "sky-blue", "forest", "burgundy"],
    views: {
      front: { zone: { x: 240, y: 270, w: 520, h: 400 } },
      back: { zone: { x: 292, y: 184, w: 416, h: 448 } },
    },
  },
  mug: {
    label: "Ceramic Mug",
    colors: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
    views: {
      front: { zone: { x: 165, y: 220, w: 475, h: 580 } },
      back: { zone: { x: 384, y: 220, w: 451, h: 580 } },
    },
  },
  cap: {
    label: "Structured Cap",
    colors: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
    views: {
      front: { zone: { x: 240, y: 260, w: 540, h: 320 } },
      back: { zone: { x: 285, y: 270, w: 430, h: 230 } },
    },
  },
  waterbottle: {
    label: "Water Bottle - White Sublimation Aluminium",
    colors: ["white"],
    views: {
      front: { zone: { x: 335, y: 320, w: 276, h: 590 } },
      back: { zone: { x: 335, y: 320, w: 276, h: 590 } },
    },
  },
};

function readPng(file) {
  const png = PNG.sync.read(readFileSync(file));
  return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height };
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
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const onBorder = x < 6 || y < 6 || x >= w - 6 || y >= h - 6;
      const onCross = Math.abs(x - y) < 6 || Math.abs(x + y - w) < 6;
      if (onBorder || onCross) {
        data[i] = 255; data[i + 1] = 90; data[i + 2] = 30; data[i + 3] = 255;
      } else {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
      }
    }
  }
  return { data, width: w, height: h };
}

/** Minimal valid PNG encoder is overkill; embed the SO as raw ARGB via a tiny PSB-free PNG. */
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
 */
export function buildMaster({ family, color, view, zone, basePng, displacePng }) {
  const base = basePng ?? readPng(path.join(BASE_DIR, `${family}__${color}__${view}.png`));
  const soId = nextSoId();

  // Smart object content: a square artwork canvas matching the print zone's
  // larger dimension, so a pasted design keeps its aspect ratio.
  const soSize = Math.max(zone.w, zone.h);
  const soDoc = artworkPlaceholder(soSize, soSize);
  const soBytes = soPngBytes(soDoc);

  // Transform mapping the smart object onto the print zone.
  // Photoshop stores this as [xx, xy, yx, yy, tx, ty] over a 0..1 unit box.
  const transform = [zone.w, 0, 0, zone.h, zone.x, zone.y];

  const layers = [];
  const linkedFiles = [];

  // 1. Studio background (bottom)
  layers.push({
    name: "Studio Background - Warm White",
    imageData: solid(CANVAS, CANVAS, 250, 248, 245, 255),
  });

  // 2. Product photo (the blank garment)
  layers.push({
    name: `Product Photo - ${color} - ${view}`,
    imageData: base,
  });

  // 3. Displacement map (hidden, reference copy)
  if (displacePng) {
    layers.push({
      name: "Displacement Map - reference copy (use the .psd beside this file)",
      hidden: true,
      imageData: displacePng,
    });
  }

  // 4. ARTWORK - the real smart object
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

  // 5. Shadow / highlight overlay would go here; keep a spare guide instead.
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

function main() {
  const argv = process.argv.slice(2);
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
  const outIdx = argv.indexOf("--out");
  const outRoot = path.resolve(outIdx >= 0 ? argv[outIdx + 1] : path.join(REPO, "dist-mockups", "masters"));

  let built = 0, failed = 0;
  for (const [family, spec] of Object.entries(CANONICAL)) {
    if (only && family !== only) continue;
    const famDir = path.join(outRoot, family);
    mkdirSync(famDir, { recursive: true });
    for (const color of spec.colors) {
      for (const [view, vspec] of Object.entries(spec.views)) {
        const basePath = path.join(BASE_DIR, `${family}__${color}__${view}.png`);
        if (!existsSync(basePath)) { console.error(`  ! missing base: ${family}/${color}/${view}`); failed++; continue; }
        const dispPath = path.join(DISPLACE_DIR, `${family}__${color}__${view}.png`);
        try {
          const { psd } = buildMaster({
            family, color, view,
            zone: vspec.zone,
            basePng: readPng(basePath),
            displacePng: existsSync(dispPath) ? readPng(dispPath) : undefined,
          });
          writeFileSync(path.join(famDir, `${family}-${color}-${view}.psd`), writePsdUint8Array(psd));

          // Standalone displacement document: Photoshop's Displace filter can
          // only read an external file, so ship it next to the master.
          if (existsSync(dispPath)) {
            writeFileSync(
              path.join(famDir, `${family}-${color}-${view}-DISPLACEMENT.psd`),
              writePsdUint8Array({
                width: CANVAS, height: CANVAS, channels: 3, bitsPerChannel: 8,
                colorMode: ColorMode_RGB,
                children: [{ name: "Displacement Map", imageData: readPng(dispPath) }],
              })
            );
          }
          built++;
        } catch (err) {
          console.error(`  ! ${family}/${color}/${view}: ${err.message}`);
          failed++;
        }
      }
    }
  }
  console.log(`built=${built} failed=${failed} -> ${outRoot}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
