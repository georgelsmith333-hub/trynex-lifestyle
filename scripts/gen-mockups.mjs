/**
 * Generates distinct mockup PNG files for every garment type × face × colour.
 *
 * Problems being fixed:
 *  - white-tshirt-front/back = white-longsleeve-front/back (all identical)
 *  - white-hoodie-front = white-hoodie-back
 *  - black-tshirt-front = black-tshirt-back
 *  - black-hoodie-front = black-hoodie-back
 *
 * Every SVG uses transparent background + white or near-black garment shape so
 * the existing SVG multiply-tint filter in GarmentSVG continues to work.
 *
 * Run: node scripts/gen-mockups.mjs
 */

import sharp from "sharp";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../artifacts/trynex-storefront/public/mockups");

mkdirSync(OUT, { recursive: true });

// ── Colour tokens ──────────────────────────────────────────────────────────
const W = {
  base: "#F9F8F6",
  mid:  "#F0EFEc",
  dark: "#E6E4E0",
  hl:   "rgba(255,255,255,0.72)",
  sh:   "rgba(0,0,0,0.10)",
  stitch: "rgba(0,0,0,0.065)",
  seam:   "rgba(0,0,0,0.055)",
  fold:   "rgba(0,0,0,0.04)",
};
const B = {
  base: "#1E1E1C",
  mid:  "#242422",
  dark: "#151513",
  hl:   "rgba(255,255,255,0.10)",
  sh:   "rgba(0,0,0,0.38)",
  stitch: "rgba(255,255,255,0.08)",
  seam:   "rgba(255,255,255,0.06)",
  fold:   "rgba(255,255,255,0.04)",
};

// ── SVG helpers ────────────────────────────────────────────────────────────
function defs(c, id) {
  return `
  <defs>
    <linearGradient id="g${id}" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%"   stop-color="${c.base}"/>
      <stop offset="42%"  stop-color="${c.mid}"/>
      <stop offset="100%" stop-color="${c.dark}"/>
    </linearGradient>
    <radialGradient id="hl${id}" cx="50%" cy="22%" r="48%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="${c.hl}"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <filter id="f${id}" x="-6%" y="-4%" width="112%" height="112%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="${c.sh}"/>
    </filter>
  </defs>`;
}

function garmentSVG(path, c, id, extras = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  ${defs(c, id)}
  <!-- drop shadow layer -->
  <path d="${path}" fill="${c.sh}" transform="translate(0,14)" filter="url(#f${id})"/>
  <!-- main garment -->
  <path d="${path}" fill="url(#g${id})"/>
  <!-- shoulder highlight -->
  <path d="${path}" fill="url(#hl${id})"/>
  ${extras}
</svg>`;
}

// ── GARMENT PATH BUILDERS ──────────────────────────────────────────────────
// All paths in 1000×1000 space. Clockwise from left-shoulder seam.

/* ──────────── SHARED BODY SEGMENTS ──────────────────────────────────────
   Returns an open path segment from the end of the LEFT sleeve (inner
   underarm point) clockwise around the body+hem+right underarm, ending
   at the start of the RIGHT sleeve inner point.
   Then each garment-type function adds its sleeves + collar and closes.
*/

// ── T-SHIRT FRONT ─────────────────────────────────────────────────────────
function tshirtFrontPath() {
  return `
M 210,126
C 192,128 165,146 138,180
C 112,214 104,265 104,316
C 104,354 112,390 132,412
C 152,434 184,446 218,450
L 218,868
C 218,880 252,890 298,893
L 500,896
L 702,893
C 748,890 782,880 782,868
L 782,450
C 816,446 848,434 868,412
C 888,390 896,354 896,316
C 896,265 888,214 862,180
C 836,146 808,128 790,126
C 772,124 700,120 600,120
C 564,120 548,128 530,168
C 514,203 504,226 500,230
C 496,226 486,203 470,168
C 452,128 436,120 400,120
C 300,120 228,124 210,126
Z`.trim();
}

// ── T-SHIRT BACK ──────────────────────────────────────────────────────────
function tshirtBackPath() {
  return `
M 210,126
C 192,128 165,146 138,180
C 112,214 104,265 104,316
C 104,354 112,390 132,412
C 152,434 184,446 218,450
L 218,868
C 218,880 252,890 298,893
L 500,896
L 702,893
C 748,890 782,880 782,868
L 782,450
C 816,446 848,434 868,412
C 888,390 896,354 896,316
C 896,265 888,214 862,180
C 836,146 808,128 790,126
C 772,124 700,120 600,120
C 566,120 552,122 537,134
C 520,148 508,160 500,163
C 492,160 480,148 463,134
C 448,122 434,120 400,120
C 300,120 228,124 210,126
Z`.trim();
}

// ── LONG SLEEVE FRONT ─────────────────────────────────────────────────────
function longsleeveFrontPath() {
  return `
M 212,126
C 195,128 170,144 148,175
C 126,206 112,250 110,310
C 108,390 108,490 108,590
C 108,680 108,748 110,800
C 112,832 118,852 135,862
L 168,868
C 185,870 205,870 224,864
L 226,834
C 226,790 225,710 224,620
C 222,520 221,450 220,450
L 220,868
C 220,880 254,890 300,893
L 500,896
L 700,893
C 746,890 780,880 780,868
L 780,450
C 779,450 778,520 776,620
C 774,710 773,790 773,834
L 775,864
C 793,870 815,870 832,868
L 865,862
C 882,852 888,832 890,800
C 892,748 892,680 892,590
C 892,490 892,390 890,310
C 888,250 874,206 852,175
C 830,144 805,128 788,126
C 770,124 700,120 600,120
C 564,120 548,128 530,168
C 514,203 504,226 500,230
C 496,226 486,203 470,168
C 452,128 436,120 400,120
C 300,120 230,124 212,126
Z`.trim();
}

// ── LONG SLEEVE BACK ──────────────────────────────────────────────────────
function longsleeveBackPath() {
  return `
M 212,126
C 195,128 170,144 148,175
C 126,206 112,250 110,310
C 108,390 108,490 108,590
C 108,680 108,748 110,800
C 112,832 118,852 135,862
L 168,868
C 185,870 205,870 224,864
L 226,834
C 226,790 225,710 224,620
C 222,520 221,450 220,450
L 220,868
C 220,880 254,890 300,893
L 500,896
L 700,893
C 746,890 780,880 780,868
L 780,450
C 779,450 778,520 776,620
C 774,710 773,790 773,834
L 775,864
C 793,870 815,870 832,868
L 865,862
C 882,852 888,832 890,800
C 892,748 892,680 892,590
C 892,490 892,390 890,310
C 888,250 874,206 852,175
C 830,144 805,128 788,126
C 770,124 700,120 600,120
C 566,120 552,122 537,134
C 520,148 508,160 500,163
C 492,160 480,148 463,134
C 448,122 434,120 400,120
C 300,120 230,124 212,126
Z`.trim();
}

// ── HOODIE FRONT ──────────────────────────────────────────────────────────
// Wider body, longer sleeves, hood above collar, front pocket
function hoodieFrontPath() {
  return `
M 200,128
C 180,130 155,150 128,185
C 102,220 93,275 92,336
C 92,380 100,418 122,442
C 144,466 178,478 215,482
L 215,876
C 215,886 250,894 298,897
L 500,900
L 702,897
C 750,894 785,886 785,876
L 785,482
C 822,478 856,466 878,442
C 900,418 908,380 908,336
C 908,275 899,220 873,185
C 847,150 822,130 800,128
C 782,126 710,122 605,120
C 572,120 558,128 542,165
C 528,198 516,222 500,235
C 484,222 472,198 458,165
C 442,128 428,120 395,120
C 290,122 218,126 200,128
Z`.trim();
}

// Kangaroo pocket on hoodie front
function hoodiePocketPath() {
  return `M 350,672 C 350,665 358,660 368,660 L 632,660 C 642,660 650,665 650,672 L 650,760 C 650,775 638,785 622,785 L 378,785 C 362,785 350,775 350,760 Z`;
}

// Hood on hoodie front
function hoodFrontPath() {
  return `
M 404,118
C 390,108 370,88 350,68
C 330,48 322,38 322,38
C 322,38 330,22 360,14
C 390,6 430,4 500,4
C 570,4 610,6 640,14
C 670,22 678,38 678,38
C 678,38 670,48 650,68
C 630,88 610,108 596,118
C 570,122 540,124 500,124
C 460,124 430,122 404,118
Z`.trim();
}

// ── HOODIE BACK ──────────────────────────────────────────────────────────
// Hood hangs down the back
function hoodieBackPath() {
  return `
M 200,128
C 180,130 155,150 128,185
C 102,220 93,275 92,336
C 92,380 100,418 122,442
C 144,466 178,478 215,482
L 215,876
C 215,886 250,894 298,897
L 500,900
L 702,897
C 750,894 785,886 785,876
L 785,482
C 822,478 856,466 878,442
C 900,418 908,380 908,336
C 908,275 899,220 873,185
C 847,150 822,130 800,128
C 782,126 710,122 605,120
C 572,120 558,124 543,136
C 528,150 514,162 500,165
C 486,162 472,150 457,136
C 442,124 428,120 395,120
C 290,122 218,126 200,128
Z`.trim();
}

// Hood hanging down the back (teardrop shape)
function hoodBackHangPath() {
  return `
M 418,118
C 400,130 380,155 366,188
C 352,220 350,255 360,285
C 368,310 384,325 400,330
L 420,334
L 500,336
L 580,334
L 600,330
C 616,325 632,310 640,285
C 650,255 648,220 634,188
C 620,155 600,130 582,118
C 558,122 530,124 500,124
C 470,124 442,122 418,118
Z`.trim();
}

// Hoodie drawstring on back
function hoodieDrawstringPath(c) {
  const col = c === W ? W.stitch : B.stitch;
  return `
  <line x1="440" y1="336" x2="410" y2="455" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="560" y1="336" x2="590" y2="455" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>
  `;
}

// ── STITCH / SEAM EXTRAS ──────────────────────────────────────────────────
function tshirtStitches(c, face) {
  const sc = c === W ? W.stitch : B.stitch;
  const fc = c === W ? W.fold : B.fold;

  // Collar stitching line
  const collarStitch = face === "front"
    ? `<path d="M 412,123 C 452,122 468,130 476,168 C 484,202 492,224 500,228 C 508,224 516,202 524,168 C 532,130 548,122 588,123" fill="none" stroke="${sc}" stroke-width="2.5" stroke-dasharray="6,4"/>`
    : `<path d="M 412,123 C 445,122 456,126 468,138 C 480,150 490,160 500,163 C 510,160 520,150 532,138 C 544,126 555,122 588,123" fill="none" stroke="${sc}" stroke-width="2.5" stroke-dasharray="6,4"/>`;

  // Shoulder seam
  const shoulderSeam = `
    <line x1="210" y1="127" x2="400" y2="121" stroke="${sc}" stroke-width="2" stroke-dasharray="5,4"/>
    <line x1="600" y1="121" x2="790" y2="127" stroke="${sc}" stroke-width="2" stroke-dasharray="5,4"/>`;

  // Bottom hem stitch
  const hemStitch = `<path d="M 222,890 L 500,896 L 778,890" fill="none" stroke="${sc}" stroke-width="2" stroke-dasharray="6,4"/>`;

  // Side seam fold lines (subtle crease)
  const sideSeam = `
    <line x1="218" y1="450" x2="218" y2="868" stroke="${fc}" stroke-width="3"/>
    <line x1="782" y1="450" x2="782" y2="868" stroke="${fc}" stroke-width="3"/>`;

  return collarStitch + shoulderSeam + hemStitch + sideSeam;
}

function longsleeveStitches(c, face) {
  const sc = c === W ? W.stitch : B.stitch;

  const collarStitch = face === "front"
    ? `<path d="M 412,123 C 452,122 468,130 476,168 C 484,202 492,224 500,228 C 508,224 516,202 524,168 C 532,130 548,122 588,123" fill="none" stroke="${sc}" stroke-width="2.5" stroke-dasharray="6,4"/>`
    : `<path d="M 412,123 C 445,122 456,126 468,138 C 480,150 490,160 500,163 C 510,160 520,150 532,138 C 544,126 555,122 588,123" fill="none" stroke="${sc}" stroke-width="2.5" stroke-dasharray="6,4"/>`;

  // Cuff stitching lines (double cuff band)
  const cuffStitch = `
    <path d="M 113,858 C 140,870 180,872 224,866" fill="none" stroke="${sc}" stroke-width="2" stroke-dasharray="5,4"/>
    <path d="M 113,844 C 140,856 180,858 224,852" fill="none" stroke="${sc}" stroke-width="2" stroke-dasharray="5,4"/>
    <path d="M 887,858 C 860,870 820,872 776,866" fill="none" stroke="${sc}" stroke-width="2" stroke-dasharray="5,4"/>
    <path d="M 887,844 C 860,856 820,858 776,852" fill="none" stroke="${sc}" stroke-width="2" stroke-dasharray="5,4"/>`;

  const hemStitch = `<path d="M 224,890 L 500,896 L 776,890" fill="none" stroke="${sc}" stroke-width="2" stroke-dasharray="6,4"/>`;

  return collarStitch + cuffStitch + hemStitch;
}

function hoodieStitches(c, face) {
  const sc = c === W ? W.stitch : B.stitch;

  const hemStitch = `<path d="M 219,893 L 500,900 L 781,893" fill="none" stroke="${sc}" stroke-width="2.5" stroke-dasharray="7,5"/>`;

  const cuffStitch = `
    <path d="M 96,330 L 96,360" stroke="${sc}" stroke-width="2"/>
    <path d="M 904,330 L 904,360" stroke="${sc}" stroke-width="2"/>`;

  const pocketStitch = face === "front"
    ? `<path d="M 352,674 L 352,762 C 352,778 362,787 378,787 L 622,787 C 638,787 648,778 648,762 L 648,674" fill="none" stroke="${sc}" stroke-width="2" stroke-dasharray="6,4"/>
       <line x1="500" y1="660" x2="500" y2="785" stroke="${sc}" stroke-width="2" stroke-dasharray="6,4"/>`
    : "";

  return hemStitch + cuffStitch + pocketStitch;
}

// ── RENDER ────────────────────────────────────────────────────────────────
async function render(svgStr, filename) {
  const outPath = join(OUT, filename);
  await sharp(Buffer.from(svgStr)).png({ compressionLevel: 8 }).toFile(outPath);
  console.log(`  ✓  ${filename}`);
}

// ── GENERATE ALL MOCKUPS ──────────────────────────────────────────────────
async function main() {
  console.log("\n🎨  Generating garment mockup PNGs…\n");

  // ── T-SHIRT FRONT WHITE ────────────────────────────────────────────────
  await render(garmentSVG(
    tshirtFrontPath(), W, "twf",
    tshirtStitches(W, "front")
  ), "white-tshirt-front.png");

  // ── T-SHIRT BACK WHITE ─────────────────────────────────────────────────
  await render(garmentSVG(
    tshirtBackPath(), W, "twb",
    tshirtStitches(W, "back")
  ), "white-tshirt-back.png");

  // ── T-SHIRT FRONT BLACK ────────────────────────────────────────────────
  await render(garmentSVG(
    tshirtFrontPath(), B, "tbf",
    tshirtStitches(B, "front")
  ), "black-tshirt-front.png");

  // ── T-SHIRT BACK BLACK ─────────────────────────────────────────────────
  await render(garmentSVG(
    tshirtBackPath(), B, "tbb",
    tshirtStitches(B, "back")
  ), "black-tshirt-back.png");

  // ── LONG SLEEVE FRONT WHITE ───────────────────────────────────────────
  await render(garmentSVG(
    longsleeveFrontPath(), W, "lwf",
    longsleeveStitches(W, "front")
  ), "white-longsleeve-front.png");

  // ── LONG SLEEVE BACK WHITE ────────────────────────────────────────────
  await render(garmentSVG(
    longsleeveBackPath(), W, "lwb",
    longsleeveStitches(W, "back")
  ), "white-longsleeve-back.png");

  // ── HOODIE FRONT WHITE ─────────────────────────────────────────────────
  {
    const hoodPath = hoodFrontPath();
    const pocketPath = hoodiePocketPath();
    const extras = `
      <!-- Hood -->
      <path d="${hoodPath}" fill="url(#ghwf)"/>
      <path d="${hoodPath}" fill="url(#hlhwf)"/>
      <!-- Hood inner shadow line -->
      <path d="M 415,118 C 445,106 468,98 500,96 C 532,98 555,106 585,118" fill="none" stroke="${W.seam}" stroke-width="3"/>
      <!-- Drawstrings -->
      <line x1="460" y1="234" x2="432" y2="455" stroke="${W.stitch}" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="540" y1="234" x2="568" y2="455" stroke="${W.stitch}" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="432" cy="460" r="7" fill="${W.mid}" stroke="${W.stitch}" stroke-width="1.5"/>
      <circle cx="568" cy="460" r="7" fill="${W.mid}" stroke="${W.stitch}" stroke-width="1.5"/>
      <!-- Pocket -->
      <path d="${pocketPath}" fill="${W.dark}" opacity="0.55"/>
      ${hoodieStitches(W, "front")}`;

    // We need the hood in the defs too, so build full svg manually
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  ${defs(W, "hwf")}
  <path d="${hoodieFrontPath()}" fill="${W.sh}" transform="translate(0,14)" filter="url(#fhwf)"/>
  <path d="${hoodPath}" fill="${W.sh}" transform="translate(0,14)" filter="url(#fhwf)"/>
  <path d="${hoodieFrontPath()}" fill="url(#ghwf)"/>
  <path d="${hoodieFrontPath()}" fill="url(#hlhwf)"/>
  ${extras}
</svg>`;
    await render(svg, "white-hoodie-front.png");
  }

  // ── HOODIE BACK WHITE ──────────────────────────────────────────────────
  {
    const hangPath = hoodBackHangPath();
    const extras = `
      <!-- Hood hanging down back -->
      <path d="${hangPath}" fill="${W.dark}" opacity="0.85"/>
      <path d="${hangPath}" fill="url(#glhwb)"/>
      <!-- Hood seam line down center back -->
      <line x1="500" y1="124" x2="500" y2="336" stroke="${W.seam}" stroke-width="3.5"/>
      ${hoodieDrawstringPath(W)}
      ${hoodieStitches(W, "back")}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  ${defs(W, "hwb")}
  <defs>
    <linearGradient id="glhwb" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${W.base}"/>
      <stop offset="100%" stop-color="${W.dark}"/>
    </linearGradient>
  </defs>
  <path d="${hoodieBackPath()}" fill="${W.sh}" transform="translate(0,14)" filter="url(#fhwb)"/>
  <path d="${hoodieBackPath()}" fill="url(#ghwb)"/>
  <path d="${hoodieBackPath()}" fill="url(#hlhwb)"/>
  ${extras}
</svg>`;
    await render(svg, "white-hoodie-back.png");
  }

  // ── HOODIE FRONT BLACK ─────────────────────────────────────────────────
  {
    const hoodPath = hoodFrontPath();
    const pocketPath = hoodiePocketPath();
    const extras = `
      <path d="${hoodPath}" fill="url(#ghbf)"/>
      <path d="${hoodPath}" fill="url(#hlhbf)"/>
      <path d="M 415,118 C 445,106 468,98 500,96 C 532,98 555,106 585,118" fill="none" stroke="${B.seam}" stroke-width="3"/>
      <line x1="460" y1="234" x2="432" y2="455" stroke="${B.stitch}" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="540" y1="234" x2="568" y2="455" stroke="${B.stitch}" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="432" cy="460" r="7" fill="${B.mid}" stroke="${B.stitch}" stroke-width="1.5"/>
      <circle cx="568" cy="460" r="7" fill="${B.mid}" stroke="${B.stitch}" stroke-width="1.5"/>
      <path d="${pocketPath}" fill="${B.dark}" opacity="0.60"/>
      ${hoodieStitches(B, "front")}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  ${defs(B, "hbf")}
  <path d="${hoodieFrontPath()}" fill="${B.sh}" transform="translate(0,14)" filter="url(#fhbf)"/>
  <path d="${hoodPath}" fill="${B.sh}" transform="translate(0,14)" filter="url(#fhbf)"/>
  <path d="${hoodieFrontPath()}" fill="url(#ghbf)"/>
  <path d="${hoodieFrontPath()}" fill="url(#hlhbf)"/>
  ${extras}
</svg>`;
    await render(svg, "black-hoodie-front.png");
  }

  // ── HOODIE BACK BLACK ──────────────────────────────────────────────────
  {
    const hangPath = hoodBackHangPath();
    const extras = `
      <path d="${hangPath}" fill="${B.dark}" opacity="0.85"/>
      <path d="${hangPath}" fill="url(#glhbb)"/>
      <line x1="500" y1="124" x2="500" y2="336" stroke="${B.seam}" stroke-width="3.5"/>
      ${hoodieDrawstringPath(B)}
      ${hoodieStitches(B, "back")}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  ${defs(B, "hbb")}
  <defs>
    <linearGradient id="glhbb" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${B.mid}"/>
      <stop offset="100%" stop-color="${B.dark}"/>
    </linearGradient>
  </defs>
  <path d="${hoodieBackPath()}" fill="${B.sh}" transform="translate(0,14)" filter="url(#fhbb)"/>
  <path d="${hoodieBackPath()}" fill="url(#ghbb)"/>
  <path d="${hoodieBackPath()}" fill="url(#hlhbb)"/>
  ${extras}
</svg>`;
    await render(svg, "black-hoodie-back.png");
  }

  console.log("\n✅  Done! All mockup PNGs generated.\n");
}

main().catch(err => { console.error("❌ Error:", err); process.exit(1); });
