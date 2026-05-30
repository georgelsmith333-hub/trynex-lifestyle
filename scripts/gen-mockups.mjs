/**
 * TryNex Garment Mockup PNG Generator — Professional Edition
 *
 * Produces 10 distinct, high-quality garment illustration PNGs that closely
 * match real product flat-lay photography style, suitable for a POD website.
 *
 * Improvements vs. the previous version:
 *  • Proportions based on real garment measurements (medium adult size)
 *  • Angular, sharp shoulder/sleeve junctions — not rounded blobs
 *  • Woven fabric-grain texture (SVG pattern)
 *  • 3-layer lighting: base gradient + studio radial highlight + edge vignette
 *  • Collar band detail (separate edge + stitching)
 *  • Hem band with double-stitch line
 *  • Vertical side-seam fold shadows
 *  • Natural underarm curve at armscye
 *  • Proper long-sleeve proportions — cuffs visible at wrist level
 *  • Hoodie with hood shell, drawstrings, kangaroo pocket (front) or
 *    hanging hood + center seam (back)
 *
 * Run:  node scripts/gen-mockups.mjs
 */

import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = join(__dir, "../artifacts/trynex-storefront/public/mockups");
mkdirSync(OUT, { recursive: true });

// ── render ────────────────────────────────────────────────────────────────
async function render(svg, file) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toFile(join(OUT, file));
  process.stdout.write(`  ✓  ${file}\n`);
}

// ── colour tokens ─────────────────────────────────────────────────────────
const W = { g0:"#FAF9F7", g1:"#F3F2EF", g2:"#E9E8E5",
            sh:"rgba(0,0,0,0.13)", hi:"rgba(255,255,255,0.30)",
            sc:"rgba(0,0,0,0.06)",  fc:"rgba(0,0,0,0.042)", dc:"rgba(0,0,0,0.030)" };
const B = { g0:"#252524", g1:"#1D1D1C", g2:"#141413",
            sh:"rgba(0,0,0,0.50)", hi:"rgba(255,255,255,0.09)",
            sc:"rgba(255,255,255,0.060)", fc:"rgba(255,255,255,0.038)", dc:"rgba(255,255,255,0.025)" };

// ── SVG definitions (per garment) ─────────────────────────────────────────
function defs(c, id) {
  return `<defs>
  <!-- Woven fabric-grain texture (2×2 twill cell) -->
  <pattern id="grain-${id}" patternUnits="userSpaceOnUse" width="4" height="4">
    <rect x="0" y="0" width="2" height="2" fill="${c.dc}" opacity="0.9"/>
    <rect x="2" y="2" width="2" height="2" fill="${c.dc}" opacity="0.9"/>
    <rect x="1" y="0" width="1" height="1" fill="${c.dc}" opacity="0.4"/>
    <rect x="3" y="2" width="1" height="1" fill="${c.dc}" opacity="0.4"/>
  </pattern>
  <!-- Base top-to-bottom gradient -->
  <linearGradient id="base-${id}" x1=".5" y1="0" x2=".5" y2="1">
    <stop offset="0%"   stop-color="${c.g0}"/>
    <stop offset="38%"  stop-color="${c.g1}"/>
    <stop offset="100%" stop-color="${c.g2}"/>
  </linearGradient>
  <!-- Studio key-light from upper-left -->
  <radialGradient id="key-${id}" cx="35%" cy="16%" r="68%" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="1000">
    <stop offset="0%"   stop-color="${c.hi}"/>
    <stop offset="48%"  stop-color="rgba(255,255,255,0)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.07)"/>
  </radialGradient>
  <!-- Edge vignette -->
  <radialGradient id="vig-${id}" cx="50%" cy="46%" r="54%" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="1000">
    <stop offset="0%"   stop-color="rgba(0,0,0,0)"/>
    <stop offset="65%"  stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.09)"/>
  </radialGradient>
  <!-- Drop-shadow filter -->
  <filter id="sh-${id}" x="-10%" y="-6%" width="120%" height="120%">
    <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="${c.sh}"/>
  </filter>
</defs>`;
}

// ── garment builder ───────────────────────────────────────────────────────
function garment(path, c, id, extras = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${defs(c, id)}
<!-- shadow layer -->
<path d="${path}" fill="${c.sh}" filter="url(#sh-${id})" transform="translate(0,16)"/>
<!-- base colour -->
<path d="${path}" fill="url(#base-${id})"/>
<!-- fabric grain -->
<path d="${path}" fill="url(#grain-${id})"/>
<!-- key light -->
<path d="${path}" fill="url(#key-${id})"/>
<!-- edge vignette -->
<path d="${path}" fill="url(#vig-${id})"/>
${extras}
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════
//  GARMENT PATHS  — 1000×1000 coordinate space, transparent background.
//
//  Proportions from a standard medium adult tee (flat-lay photography):
//    body width  ~520px  (x 240–760)
//    garment ht  ~770px  (y 110–880)
//    collar w    ~190px  (x 405–595)
//    front neck  ~105px deep (y 215 at deepest)
//    back neck    ~25px deep (y 140 at deepest)
//    short sleeve ~190px long, tip at y≈315
//    long sleeve  to wrist y≈830
//    hoodie body  ~560px wide (x 220–780)
// ══════════════════════════════════════════════════════════════════════════

// ── shared body segment: left-cuff→body→hem→body→right-cuff ──────────────
//    used by both t-shirt and long sleeve (collar + sleeve paths differ).

// ──────────────── T-SHIRT ─────────────────────────────────────────────────
function tshirtPath(face) {
  // Outer silhouette (clockwise) from left-collar-base:
  const collar = face === "front"
    ? `C 600,116 638,116 602,116
       C 568,116 552,130 536,170
       C 520,204 508,228 500,234
       C 492,228 480,204 464,170
       C 448,130 432,116 398,116
       C 362,116 300,120 262,130
       Z`
    : `C 600,116 636,116 602,116
       C 572,115 558,120 543,133
       C 528,146 514,156 500,159
       C 486,156 472,146 457,133
       C 442,120 428,115 398,116
       C 362,116 300,120 262,130
       Z`;

  return `M 262,130
C 248,132 237,138 232,148
C 218,160 178,182 136,220
C 96,258 76,298 74,332
C 72,354 77,380 92,404
C 107,428 150,442 216,449
C 222,453 226,457 228,463
L 228,868
C 228,880 262,892 336,895
L 500,898
L 664,895
C 738,892 772,880 772,868
L 772,463
C 774,457 778,453 784,449
C 850,442 893,428 908,404
C 923,380 928,354 926,332
C 924,298 904,258 864,220
C 822,182 782,160 768,148
C 763,138 752,132 738,130
C 712,124 642,116 ${collar}`;
}

// ── t-shirt detail overlays ───────────────────────────────────────────────
function tshirtDetails(c, id, face) {
  const sc = c.sc, fc = c.fc, dc = c.dc;

  const collarLine = face === "front"
    ? `M 398,116 C 432,112 448,126 464,168 C 480,204 492,228 500,234 C 508,228 520,204 536,168 C 552,126 568,112 602,116`
    : `M 398,116 C 428,113 442,118 456,131 C 470,143 484,154 500,157 C 516,154 530,143 544,131 C 558,118 572,113 602,116`;

  return `
<!-- Collar band edge -->
<path d="${collarLine}" fill="none" stroke="${sc}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${collarLine}" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4.5,3" stroke-linecap="round"/>
<!-- Shoulder seams (stitched) -->
<path d="M 262,130 C 300,122 360,116 398,116" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<path d="M 738,130 C 700,122 640,116 602,116" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<!-- Hem band -->
<path d="M 230,874 C 265,888 338,896 500,899 C 662,896 735,888 770,874" fill="none" stroke="${sc}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M 230,874 C 265,888 338,896 500,899 C 662,896 735,888 770,874" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3.5" stroke-linecap="round"/>
<!-- Side-seam fold shadows -->
<path d="M 228,464 C 226,540 225,640 225,750 L 225,868" fill="none" stroke="${fc}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M 772,464 C 774,540 775,640 775,750 L 775,868" fill="none" stroke="${fc}" stroke-width="2.5" stroke-linecap="round"/>
<!-- Subtle centre-front crease -->
<path d="M 500,238 C 498,330 497,460 500,600 C 503,700 500,800 500,868" fill="none" stroke="${dc}" stroke-width="1.5" stroke-linecap="round"/>`;
}

// ──────────────── LONG SLEEVE ──────────────────────────────────────────────
function longsleevePath(face) {
  const collar = face === "front"
    ? `C 568,116 552,130 536,170
       C 520,204 508,228 500,234
       C 492,228 480,204 464,170
       C 448,130 432,116 398,116
       C 362,116 300,120 262,130
       Z`
    : `C 572,115 558,120 543,133
       C 528,146 514,156 500,159
       C 486,156 472,146 457,133
       C 442,120 428,115 398,116
       C 362,116 300,120 262,130
       Z`;

  return `M 262,130
C 248,132 237,138 232,148
C 218,160 178,182 136,220
C 96,258 76,298 74,355
C 73,440 73,540 74,638
C 76,718 78,782 82,826
C 86,852 96,868 118,876
L 160,882
C 180,884 206,884 226,878
L 226,848
C 225,800 224,726 223,648
C 222,558 221,474 221,464
L 228,868
C 228,880 262,892 336,895
L 500,898
L 664,895
C 738,892 772,880 772,868
L 779,464
C 779,474 778,558 777,648
C 776,726 775,800 774,848
L 774,878
C 794,884 820,884 840,882
L 882,876
C 904,868 914,852 918,826
C 922,782 924,718 926,638
C 927,540 927,440 926,355
C 924,298 904,258 864,220
C 822,182 782,160 768,148
C 763,138 752,132 738,130
C 712,124 642,116 602,116
C ${collar}`;
}

function longsleeveDetails(c, id, face) {
  const sc = c.sc, fc = c.fc, dc = c.dc;

  const collarLine = face === "front"
    ? `M 398,116 C 432,112 448,126 464,168 C 480,204 492,228 500,234 C 508,228 520,204 536,168 C 552,126 568,112 602,116`
    : `M 398,116 C 428,113 442,118 456,131 C 470,143 484,154 500,157 C 516,154 530,143 544,131 C 558,118 572,113 602,116`;

  return `
<!-- Collar band -->
<path d="${collarLine}" fill="none" stroke="${sc}" stroke-width="6" stroke-linecap="round"/>
<path d="${collarLine}" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4.5,3" stroke-linecap="round"/>
<!-- Shoulder seams -->
<path d="M 262,130 C 300,122 360,116 398,116" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<path d="M 738,130 C 700,122 640,116 602,116" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<!-- Left cuff double-stitch band -->
<path d="M 76,855 C 96,870 140,880 192,882" fill="none" stroke="${sc}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M 78,840 C 98,856 142,866 194,868" fill="none" stroke="${sc}" stroke-width="3" stroke-linecap="round"/>
<path d="M 76,855 C 96,870 140,880 192,882" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Right cuff double-stitch band -->
<path d="M 924,855 C 904,870 860,880 808,882" fill="none" stroke="${sc}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M 922,840 C 902,856 858,866 806,868" fill="none" stroke="${sc}" stroke-width="3" stroke-linecap="round"/>
<path d="M 924,855 C 904,870 860,880 808,882" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Hem band -->
<path d="M 230,874 C 265,888 338,896 500,899 C 662,896 735,888 770,874" fill="none" stroke="${sc}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M 230,874 C 265,888 338,896 500,899 C 662,896 735,888 770,874" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3.5" stroke-linecap="round"/>
<!-- Side seams -->
<path d="M 221,466 C 220,560 220,660 220,760 L 220,868" fill="none" stroke="${fc}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M 779,466 C 780,560 780,660 780,760 L 780,868" fill="none" stroke="${fc}" stroke-width="2.5" stroke-linecap="round"/>`;
}

// ──────────────── HOODIE ──────────────────────────────────────────────────
// Body is slightly wider than t-shirt; sleeves are thick/ribbed at cuff.

function hoodieBodyPath() {
  // Wider body (220–780) with slightly longer sleeves
  return `M 248,134
C 232,136 220,142 215,153
C 200,166 160,190 118,230
C 78,270 56,314 54,350
C 52,375 58,402 74,428
C 90,454 135,470 208,478
C 216,482 220,486 222,494
L 222,874
C 222,886 256,898 330,901
L 500,904
L 670,901
C 744,898 778,886 778,874
L 778,494
C 780,486 784,482 792,478
C 865,470 910,454 926,428
C 942,402 948,375 946,350
C 944,314 922,270 882,230
C 840,190 800,166 785,153
C 780,142 768,136 752,134`;
}

function hoodieFrontPath() {
  return hoodieBodyPath() + `
C 714,128 644,120 605,118
C 572,117 558,130 542,170
C 526,207 512,232 500,238
C 488,232 474,207 458,170
C 442,130 428,117 395,118
C 356,120 286,128 248,134
Z`;
}

function hoodieBackPath() {
  return hoodieBodyPath() + `
C 714,128 644,120 605,118
C 575,116 560,122 544,136
C 528,148 514,160 500,163
C 486,160 472,148 456,136
C 440,122 425,116 395,118
C 356,120 286,128 248,134
Z`;
}

// Hood shell (front view — lies over collar, V-opening in middle)
function hoodFrontPath() {
  return `M 408,116
C 390,104 368,84 350,60
C 334,38 328,26 330,22
C 340,10 368,4 400,2
C 430,0 465,2 500,2
C 535,2 570,0 600,2
C 632,4 660,10 670,22
C 672,26 666,38 650,60
C 632,84 610,104 592,116
C 564,120 534,122 500,122
C 466,122 436,120 408,116
Z`;
}

// Hood hanging down back
function hoodBackPath() {
  return `M 420,116
C 402,128 382,152 368,184
C 354,218 350,256 360,288
C 368,314 386,330 404,336
L 424,340
L 500,342
L 576,340
L 596,336
C 614,330 632,314 640,288
C 650,256 646,218 632,184
C 618,152 598,128 580,116
C 554,120 528,122 500,122
C 472,122 446,120 420,116
Z`;
}

// Kangaroo pocket (front only)
function hoodiePocketPath() {
  return `M 345,668 C 342,660 350,652 362,652 L 638,652 C 650,652 658,660 655,668
          L 648,762 C 646,778 635,788 620,788 L 380,788 C 365,788 354,778 352,762 Z`;
}

function hoodieDetails(c, id, face, isWhite) {
  const sc = c.sc, fc = c.fc, dc = c.dc;
  const collarLine = face === "front"
    ? `M 395,118 C 428,114 442,128 458,168 C 474,206 488,230 500,236 C 512,230 526,206 542,168 C 558,128 572,114 605,118`
    : `M 395,118 C 426,114 440,120 455,134 C 469,147 484,158 500,161 C 516,158 531,147 545,134 C 560,120 574,114 605,118`;

  const hemBand = `
<path d="M 224,880 C 258,894 332,902 500,905 C 668,902 742,894 776,880" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 224,880 C 258,894 332,902 500,905 C 668,902 742,894 776,880" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3.5" stroke-linecap="round"/>`;

  const seams = `
<path d="M 222,496 C 220,580 219,680 219,780 L 219,874" fill="none" stroke="${fc}" stroke-width="2.8" stroke-linecap="round"/>
<path d="M 778,496 C 780,580 781,680 781,780 L 781,874" fill="none" stroke="${fc}" stroke-width="2.8" stroke-linecap="round"/>`;

  if (face === "front") {
    // Drawstrings hanging from hood
    const cordColour = isWhite ? "rgba(160,155,148,0.70)" : "rgba(100,95,90,0.70)";
    const pocket = hoodiePocketPath();
    const pocketFill = isWhite ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
    return `
<!-- Collar band -->
<path d="${collarLine}" fill="none" stroke="${sc}" stroke-width="6.5" stroke-linecap="round"/>
<path d="${collarLine}" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4.5,3" stroke-linecap="round"/>
${hemBand}${seams}
<!-- Kangaroo pocket -->
<path d="${pocket}" fill="${pocketFill}"/>
<path d="${pocket}" fill="none" stroke="${sc}" stroke-width="2.5" stroke-linejoin="round"/>
<line x1="500" y1="652" x2="500" y2="788" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3"/>
<!-- Drawcords from hood -->
<path d="M 458,238 C 452,310 448,388 446,460" fill="none" stroke="${cordColour}" stroke-width="3.5" stroke-linecap="round"/>
<path d="M 542,238 C 548,310 552,388 554,460" fill="none" stroke="${cordColour}" stroke-width="3.5" stroke-linecap="round"/>
<circle cx="446" cy="465" r="6" fill="${isWhite?"#DEDAD5":"#3A3A38"}" stroke="${sc}" stroke-width="1.5"/>
<circle cx="554" cy="465" r="6" fill="${isWhite?"#DEDAD5":"#3A3A38"}" stroke="${sc}" stroke-width="1.5"/>`;
  } else {
    // Back: hood hang + centre seam + cords
    const cordColour = isWhite ? "rgba(160,155,148,0.65)" : "rgba(100,95,90,0.65)";
    return `
<!-- Collar band (back) -->
<path d="${collarLine}" fill="none" stroke="${sc}" stroke-width="6.5" stroke-linecap="round"/>
<path d="${collarLine}" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4.5,3" stroke-linecap="round"/>
${hemBand}${seams}
<!-- Centre back seam of hood -->
<line x1="500" y1="122" x2="500" y2="342" stroke="${sc}" stroke-width="3.5" stroke-linecap="round"/>
<line x1="500" y1="122" x2="500" y2="342" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3"/>
<!-- Drawcords from hood back -->
<path d="M 440,340 C 434,390 430,440 428,480" fill="none" stroke="${cordColour}" stroke-width="3.5" stroke-linecap="round"/>
<path d="M 560,340 C 566,390 570,440 572,480" fill="none" stroke="${cordColour}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  GENERATE ALL FILES
// ══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("\n🎨  Generating garment mockup PNGs (professional edition)…\n");

  // ── WHITE T-SHIRT FRONT ───────────────────────────────────────────────
  await render(garment(tshirtPath("front"), W, "twf", tshirtDetails(W,"twf","front")),
    "white-tshirt-front.png");

  // ── WHITE T-SHIRT BACK ────────────────────────────────────────────────
  await render(garment(tshirtPath("back"),  W, "twb", tshirtDetails(W,"twb","back")),
    "white-tshirt-back.png");

  // ── BLACK T-SHIRT FRONT ───────────────────────────────────────────────
  await render(garment(tshirtPath("front"), B, "tbf", tshirtDetails(B,"tbf","front")),
    "black-tshirt-front.png");

  // ── BLACK T-SHIRT BACK ────────────────────────────────────────────────
  await render(garment(tshirtPath("back"),  B, "tbb", tshirtDetails(B,"tbb","back")),
    "black-tshirt-back.png");

  // ── WHITE LONG SLEEVE FRONT ───────────────────────────────────────────
  await render(garment(longsleevePath("front"), W, "lwf", longsleeveDetails(W,"lwf","front")),
    "white-longsleeve-front.png");

  // ── WHITE LONG SLEEVE BACK ────────────────────────────────────────────
  await render(garment(longsleevePath("back"),  W, "lwb", longsleeveDetails(W,"lwb","back")),
    "white-longsleeve-back.png");

  // ── WHITE HOODIE FRONT ────────────────────────────────────────────────
  {
    const body = hoodieFrontPath();
    const hood = hoodFrontPath();
    const det  = hoodieDetails(W, "hwf", "front", true);
    const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${defs(W,"hwf")}
<!-- body shadow -->
<path d="${body}" fill="${W.sh}" filter="url(#sh-hwf)" transform="translate(0,16)"/>
<!-- hood shadow -->
<path d="${hood}" fill="${W.sh}" filter="url(#sh-hwf)" transform="translate(0,16)"/>
<!-- body layers -->
<path d="${body}" fill="url(#base-hwf)"/>
<path d="${body}" fill="url(#grain-hwf)"/>
<path d="${body}" fill="url(#key-hwf)"/>
<path d="${body}" fill="url(#vig-hwf)"/>
<!-- hood layers (same palette) -->
<path d="${hood}" fill="url(#base-hwf)"/>
<path d="${hood}" fill="url(#grain-hwf)"/>
<path d="${hood}" fill="url(#key-hwf)"/>
<!-- hood inner-edge shadow (depth) -->
<path d="M 412,114 C 445,104 468,96 500,94 C 532,96 555,104 588,114" fill="none" stroke="${W.sc}" stroke-width="4" stroke-linecap="round"/>
${det}
</svg>`;
    await render(svg, "white-hoodie-front.png");
  }

  // ── WHITE HOODIE BACK ─────────────────────────────────────────────────
  {
    const body = hoodieBackPath();
    const hood = hoodBackPath();
    const det  = hoodieDetails(W, "hwb", "back", true);
    const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${defs(W,"hwb")}
<defs>
  <linearGradient id="hoodgrad-hwb" x1=".5" y1="0" x2=".5" y2="1">
    <stop offset="0%"   stop-color="${W.g1}"/>
    <stop offset="100%" stop-color="${W.g2}"/>
  </linearGradient>
</defs>
<path d="${body}" fill="${W.sh}" filter="url(#sh-hwb)" transform="translate(0,16)"/>
<path d="${hood}" fill="${W.sh}" filter="url(#sh-hwb)" transform="translate(0,16)"/>
<path d="${body}" fill="url(#base-hwb)"/>
<path d="${body}" fill="url(#grain-hwb)"/>
<path d="${body}" fill="url(#key-hwb)"/>
<path d="${body}" fill="url(#vig-hwb)"/>
<!-- hanging hood (slightly darker than body) -->
<path d="${hood}" fill="url(#hoodgrad-hwb)"/>
<path d="${hood}" fill="url(#grain-hwb)"/>
${det}
</svg>`;
    await render(svg, "white-hoodie-back.png");
  }

  // ── BLACK HOODIE FRONT ────────────────────────────────────────────────
  {
    const body = hoodieFrontPath();
    const hood = hoodFrontPath();
    const det  = hoodieDetails(B, "hbf", "front", false);
    const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${defs(B,"hbf")}
<path d="${body}" fill="${B.sh}" filter="url(#sh-hbf)" transform="translate(0,16)"/>
<path d="${hood}" fill="${B.sh}" filter="url(#sh-hbf)" transform="translate(0,16)"/>
<path d="${body}" fill="url(#base-hbf)"/>
<path d="${body}" fill="url(#grain-hbf)"/>
<path d="${body}" fill="url(#key-hbf)"/>
<path d="${body}" fill="url(#vig-hbf)"/>
<path d="${hood}" fill="url(#base-hbf)"/>
<path d="${hood}" fill="url(#grain-hbf)"/>
<path d="${hood}" fill="url(#key-hbf)"/>
<path d="M 412,114 C 445,104 468,96 500,94 C 532,96 555,104 588,114" fill="none" stroke="${B.sc}" stroke-width="4" stroke-linecap="round"/>
${det}
</svg>`;
    await render(svg, "black-hoodie-front.png");
  }

  // ── BLACK HOODIE BACK ─────────────────────────────────────────────────
  {
    const body = hoodieBackPath();
    const hood = hoodBackPath();
    const det  = hoodieDetails(B, "hbb", "back", false);
    const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${defs(B,"hbb")}
<defs>
  <linearGradient id="hoodgrad-hbb" x1=".5" y1="0" x2=".5" y2="1">
    <stop offset="0%"   stop-color="${B.g1}"/>
    <stop offset="100%" stop-color="${B.g2}"/>
  </linearGradient>
</defs>
<path d="${body}" fill="${B.sh}" filter="url(#sh-hbb)" transform="translate(0,16)"/>
<path d="${hood}" fill="${B.sh}" filter="url(#sh-hbb)" transform="translate(0,16)"/>
<path d="${body}" fill="url(#base-hbb)"/>
<path d="${body}" fill="url(#grain-hbb)"/>
<path d="${body}" fill="url(#key-hbb)"/>
<path d="${body}" fill="url(#vig-hbb)"/>
<path d="${hood}" fill="url(#hoodgrad-hbb)"/>
<path d="${hood}" fill="url(#grain-hbb)"/>
${det}
</svg>`;
    await render(svg, "black-hoodie-back.png");
  }

  console.log("\n✅  Done — all 10 garment mockup PNGs regenerated.\n");
}

main().catch(e => { console.error("❌", e); process.exit(1); });
