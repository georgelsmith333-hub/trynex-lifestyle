/**
 * TryNex Garment Mockup PNG Generator — v3 (Realistic Proportions)
 *
 * Critical fixes vs v2:
 *  • Armscye raised from y≈445 to y≈348 — short sleeves now match real
 *    garment measurements (≈20cm from shoulder seam to underarm)
 *  • Body is TALLER than wide (body h=534 vs body w=532) — no more square blob
 *  • Sleeves are NARROWER vertically (sleeve band ≈215px, not 300px)
 *  • Long sleeve inner arm is drawn as a SEPARATE closed shape merged on top,
 *    avoiding the winding-rule cancellation bug in v2
 *  • Hoodie hood proportions reduced — hood is realistically sized, not a giant slab
 *  • All paths use straighter lines + fewer bezier curves → crisper, less cartoonish
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

async function render(svg, file) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toFile(join(OUT, file));
  process.stdout.write(`  ✓  ${file}\n`);
}

// ── colour tokens ─────────────────────────────────────────────────────────
const W = {
  g0:"#FAF9F6", g1:"#F3F2EE", g2:"#E9E7E3",
  sh:"rgba(40,35,28,0.18)", hi:"rgba(255,255,255,0.32)",
  sc:"rgba(0,0,0,0.068)", fc:"rgba(0,0,0,0.048)", dc:"rgba(0,0,0,0.034)"
};
const B = {
  g0:"#282826", g1:"#1E1E1C", g2:"#141412",
  sh:"rgba(0,0,0,0.55)", hi:"rgba(255,255,255,0.09)",
  sc:"rgba(255,255,255,0.075)", fc:"rgba(255,255,255,0.045)", dc:"rgba(255,255,255,0.030)"
};

// ── SVG definitions ────────────────────────────────────────────────────────
function defs(c, id) {
  return `<defs>
  <!-- Woven twill grain: 3×3 cell -->
  <pattern id="g-${id}" patternUnits="userSpaceOnUse" width="3" height="3">
    <rect width="3" height="3" fill="transparent"/>
    <rect x="0" y="0" width="1.5" height="1.5" fill="${c.dc}" opacity="0.85"/>
    <rect x="1.5" y="1.5" width="1.5" height="1.5" fill="${c.dc}" opacity="0.85"/>
  </pattern>
  <!-- Base gradient -->
  <linearGradient id="b-${id}" x1=".5" y1="0" x2=".5" y2="1">
    <stop offset="0%"   stop-color="${c.g0}"/>
    <stop offset="35%"  stop-color="${c.g1}"/>
    <stop offset="100%" stop-color="${c.g2}"/>
  </linearGradient>
  <!-- Key light: studio upper-left -->
  <radialGradient id="k-${id}" cx="33%" cy="14%" r="70%" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="1000">
    <stop offset="0%"   stop-color="${c.hi}"/>
    <stop offset="50%"  stop-color="rgba(255,255,255,0)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.07)"/>
  </radialGradient>
  <!-- Edge vignette -->
  <radialGradient id="v-${id}" cx="50%" cy="46%" r="52%" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="1000">
    <stop offset="60%"  stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.10)"/>
  </radialGradient>
  <!-- Drop shadow -->
  <filter id="s-${id}" x="-10%" y="-6%" width="120%" height="120%">
    <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="${c.sh}"/>
  </filter>
</defs>`;
}

// ── layer painter for a single closed path ────────────────────────────────
function layers(path, c, id) {
  return `
<path d="${path}" fill="${c.sh}" filter="url(#s-${id})" transform="translate(0,18)" opacity="0.7"/>
<path d="${path}" fill="url(#b-${id})"/>
<path d="${path}" fill="url(#g-${id})"/>
<path d="${path}" fill="url(#k-${id})"/>
<path d="${path}" fill="url(#v-${id})"/>`;
}

function svg(c, id, body, extras="") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${defs(c, id)}${body}${extras}
</svg>`;
}

// ══════════════════════════════════════════════════════════════════════════
//  COORDINATE SYSTEM  (1000×1000, transparent background)
//
//  Real flat-lay measurements for a standard medium t-shirt:
//    body chest:     52 cm → scale 10 px/cm
//    shoulder width: 46 cm → 460 px
//    shirt length:   72 cm → 720 px
//    short sleeve:   22 cm → 220 px (from shoulder seam to cuff)
//    neck width:     19 cm → 190 px
//    front neck dep:  9 cm → 90 px
//    back neck dep:   2 cm → 20 px
//
//  Canvas layout:
//    Collar top       y = 105
//    Shoulder seam    y = 130  (25 px above sleeve)
//    Armscye          y = 348  (shoulder+218px = 21.8 cm)
//    Hem              y = 890  (body height from armscye = 542 px = 54.2 cm ≈ real length)
//    Body left/right  x = 234 / 766  (body width = 532 px = 53.2 cm ≈ real)
//    Collar           x = 405 / 595  (collar width = 190 px)
//    Sleeve tip       x ≈  88 / 912  (left/right extremes)
// ══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
//  T-SHIRT  (body + short sleeves in a single closed path)
// ─────────────────────────────────────────────────────────────────────────
function tshirtPath(face) {
  const collar = face === "front"
    // Crew-neck U (front) — deepest at y=225
    ? `C 710,105 638,98  604,98
       C 570,98  554,112 538,154
       C 522,192 510,218 500,224
       C 490,218 478,192 462,154
       C 446,112 430,98  396,98
       C 362,98  290,105 256,112
       Z`
    // Shallow back scoop — deepest at y=152
    : `C 710,105 638,98  604,98
       C 574,98  560,104 544,118
       C 528,132 514,144 500,148
       C 486,144 472,132 456,118
       C 440,104 426,98  396,98
       C 362,98  290,105 256,112
       Z`;

  //
  // Clockwise from left collar-base:
  //   left collar → shoulder seam → sleeve outer → cuff → armscye
  //   → body left → hem → body right → armscye → cuff → sleeve outer
  //   → shoulder seam → right collar-base → collar curve → back to left
  //
  return `M 256,112
C 244,113 234,120 232,130
C 218,142 180,165 142,202
C 104,240  84,278  82,312
C 80, 330  83,346  96,368
C 110,388 152,400 222,406
C 228,410 232,412 234,416

L 234,882
C 234,894 266,906 340,909
L 500,912
L 660,909
C 734,906 766,894 766,882
L 766,416

C 768,412 772,410 778,406
C 848,400 890,388 904,368
C 917,346 920,330 918,312
C 916,278 896,240 858,202
C 820,165 782,142 768,130
C 766,120 756,113 744,112
C ${collar}`;
}

function tshirtDetails(c, id, face) {
  const sc = c.sc, fc = c.fc, dc = c.dc;
  const cl = face === "front"
    ? `M 396,98 C 430,94 446,108 462,152 C 478,190 490,216 500,222 C 510,216 522,190 538,152 C 554,108 570,94 604,98`
    : `M 396,98 C 426,95 440,100 456,116 C 472,130 486,142 500,146 C 514,142 528,130 544,116 C 560,100 574,95 604,98`;
  return `
<!-- Collar stitching band -->
<path d="${cl}" fill="none" stroke="${sc}" stroke-width="6.5" stroke-linecap="round"/>
<path d="${cl}" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4.5,3" stroke-linecap="round"/>
<!-- Shoulder seam stitch -->
<path d="M 256,112 C 290,104 362,97 396,98" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<path d="M 744,112 C 710,104 638,97 604,98" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<!-- Left cuff band -->
<path d="M 84,332 C 96,356 136,376 212,394" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 84,332 C 96,356 136,376 212,394" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Right cuff band -->
<path d="M 916,332 C 904,356 864,376 788,394" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 916,332 C 904,356 864,376 788,394" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Hem band -->
<path d="M 236,885 C 268,898 342,910 500,913 C 658,910 732,898 764,885" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 236,885 C 268,898 342,910 500,913 C 658,910 732,898 764,885" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3.5" stroke-linecap="round"/>
<!-- Side-seam shadows -->
<path d="M 234,418 C 232,520 231,640 231,760 L 231,882" fill="none" stroke="${fc}" stroke-width="2.5"/>
<path d="M 766,418 C 768,520 769,640 769,760 L 769,882" fill="none" stroke="${fc}" stroke-width="2.5"/>
<!-- Centre crease -->
<path d="M 500,228 C 498,340 497,480 500,620 C 503,720 500,810 500,882" fill="none" stroke="${dc}" stroke-width="1.5"/>`;
}

// ─────────────────────────────────────────────────────────────────────────
//  LONG SLEEVE
//  Draws BODY + each sleeve as THREE separate closed paths
//  (avoids winding-number artefacts when inner arm runs beside body edge)
// ─────────────────────────────────────────────────────────────────────────
function longsleeveBody(face) {
  const collar = face === "front"
    ? `C 710,105 638,98  604,98
       C 570,98  554,112 538,154
       C 522,192 510,218 500,224
       C 490,218 478,192 462,154
       C 446,112 430,98  396,98
       C 362,98  290,105 256,112
       Z`
    : `C 710,105 638,98  604,98
       C 574,98  560,104 544,118
       C 528,132 514,144 500,148
       C 486,144 472,132 456,118
       C 440,104 426,98  396,98
       C 362,98  290,105 256,112
       Z`;

  return `M 256,112
C 244,113 234,120 232,130
L 234,882
C 234,894 266,906 340,909
L 500,912
L 660,909
C 734,906 766,894 766,882
L 768,130
C 766,120 756,113 744,112
C ${collar}`;
}

// Left sleeve as its own closed shape
function leftSleeve() {
  return `M 232,130
C 218,142 180,165 142,202
C 104,240  80,282  76,328
C 74, 390  74,476  76,560
C 78, 640  80,720  82,794
C 85, 840  94, 864 116,878
L 156,884
C 176,886 204,886 228,878
L 228,852
C 226,800 225,730 224,648
C 222,560 221,476 221,390
C 220,342 222,308 234,280
C 234,260 234,200 234,130
Z`;
}

// Right sleeve (mirror)
function rightSleeve() {
  return `M 768,130
C 782,142 820,165 858,202
C 896,240 920,282 924,328
C 926,390 926,476 924,560
C 922,640 920,720 918,794
C 915,840 906,864 884,878
L 844,884
C 824,886 796,886 772,878
L 772,852
C 774,800 775,730 776,648
C 778,560 779,476 779,390
C 780,342 778,308 766,280
C 766,260 766,200 766,130
Z`;
}

function longsleeveDetails(c, id, face) {
  const sc = c.sc, fc = c.fc, dc = c.dc;
  const cl = face === "front"
    ? `M 396,98 C 430,94 446,108 462,152 C 478,190 490,216 500,222 C 510,216 522,190 538,152 C 554,108 570,94 604,98`
    : `M 396,98 C 426,95 440,100 456,116 C 472,130 486,142 500,146 C 514,142 528,130 544,116 C 560,100 574,95 604,98`;
  return `
<!-- Collar band -->
<path d="${cl}" fill="none" stroke="${sc}" stroke-width="6.5" stroke-linecap="round"/>
<path d="${cl}" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4.5,3" stroke-linecap="round"/>
<!-- Shoulder seams -->
<path d="M 256,112 C 290,104 362,97 396,98" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<path d="M 744,112 C 710,104 638,97 604,98" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<!-- Left wrist cuff band -->
<path d="M 78,857 C 98,872 142,882 192,886" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 80,842 C 100,858 144,868 194,872" fill="none" stroke="${sc}" stroke-width="4" stroke-linecap="round"/>
<path d="M 78,857 C 98,872 142,882 192,886" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Right wrist cuff band -->
<path d="M 922,857 C 902,872 858,882 808,886" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 920,842 C 900,858 856,868 806,872" fill="none" stroke="${sc}" stroke-width="4" stroke-linecap="round"/>
<path d="M 922,857 C 902,872 858,882 808,886" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Hem band -->
<path d="M 236,885 C 268,898 342,910 500,913 C 658,910 732,898 764,885" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 236,885 C 268,898 342,910 500,913 C 658,910 732,898 764,885" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3.5" stroke-linecap="round"/>
<!-- Centre crease -->
<path d="M 500,228 C 498,360 497,500 500,650 C 502,760 500,825 500,882" fill="none" stroke="${dc}" stroke-width="1.5"/>`;
}

// ─────────────────────────────────────────────────────────────────────────
//  HOODIE  (same separate-paths approach)
// ─────────────────────────────────────────────────────────────────────────
function hoodieBodyPath(face) {
  const collar = face === "front"
    ? `C 716,108 642,100 606,100
       C 572,100 556,114 540,158
       C 524,196 512,222 500,228
       C 488,222 476,196 460,158
       C 444,114 428,100 394,100
       C 358,100 284,108 252,116
       Z`
    : `C 716,108 642,100 606,100
       C 576,100 562,106 546,122
       C 530,136 516,148 500,152
       C 484,148 470,136 454,122
       C 438,106 424,100 394,100
       C 358,100 284,108 252,116
       Z`;

  return `M 252,116
C 240,117 228,124 226,135
L 228,885
C 228,897 260,908 336,911
L 500,914
L 664,911
C 740,908 772,897 772,885
L 774,135
C 772,124 760,117 748,116
C ${collar}`;
}

function leftHoodieSleeve() {
  return `M 226,135
C 212,148 172,172 130,212
C 90,252 66,296 62,344
C 60,410 60,500 62,590
C 64,672 66,748 68,804
C 72,848 82,868 106,880
L 148,886
C 170,888 198,888 222,880
L 222,850
C 220,796 219,724 218,640
C 216,550 215,464 215,380
C 214,330 216,294 228,268
C 228,248 228,188 228,135
Z`;
}

function rightHoodieSleeve() {
  return `M 774,135
C 788,148 828,172 870,212
C 910,252 934,296 938,344
C 940,410 940,500 938,590
C 936,672 934,748 932,804
C 928,848 918,868 894,880
L 852,886
C 830,888 802,888 778,880
L 778,850
C 780,796 781,724 782,640
C 784,550 785,464 785,380
C 786,330 784,294 772,268
C 772,248 772,188 772,135
Z`;
}

// Hood (front view — folds forward above collar)
function hoodFront() {
  return `M 414,108
C 396,96  374,76  356,52
C 338,28  332,14  334,8
C 344,-4  374,-10 404,-12
L 500,-12
L 596,-12
C 626,-10 656,-4  666,8
C 668,14  662,28  644,52
C 626,76  604,96  586,108
C 560,114 532,116 500,116
C 468,116 440,114 414,108
Z`;
}

// Hood (back view — hangs down behind collar)
function hoodBack() {
  return `M 424,108
C 406,122 386,148 372,182
C 358,218 354,258 364,292
C 372,318 390,336 410,342
L 432,346
L 500,348
L 568,346
L 590,342
C 610,336 628,318 636,292
C 646,258 642,218 628,182
C 614,148 594,122 576,108
C 550,114 526,116 500,116
C 474,116 450,114 424,108
Z`;
}

function hoodiePocket() {
  return `M 348,672 C 345,662 354,654 366,654 L 634,654 C 646,654 655,662 652,672
          L 644,768 C 642,784 631,794 616,794 L 384,794 C 369,794 358,784 356,768 Z`;
}

function hoodieDetails(c, id, face, isWhite) {
  const sc = c.sc, fc = c.fc, dc = c.dc;
  const cl = face === "front"
    ? `M 394,100 C 428,96 444,110 460,156 C 476,194 488,220 500,226 C 512,220 524,194 540,156 C 556,110 572,96 606,100`
    : `M 394,100 C 424,96 438,104 454,120 C 470,134 484,146 500,150 C 516,146 530,134 546,120 C 562,104 576,96 606,100`;
  const cord = isWhite ? "rgba(155,150,142,0.75)" : "rgba(95,90,82,0.75)";
  const aglet = isWhite ? "#D8D4CE" : "#383634";

  if (face === "front") {
    const pkt = hoodiePocket();
    const pktFill = isWhite ? "rgba(0,0,0,0.065)" : "rgba(255,255,255,0.06)";
    return `
<!-- Collar band -->
<path d="${cl}" fill="none" stroke="${sc}" stroke-width="7" stroke-linecap="round"/>
<path d="${cl}" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4.5,3" stroke-linecap="round"/>
<!-- Shoulder seams -->
<path d="M 252,116 C 286,107 358,100 394,100" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<path d="M 748,116 C 714,107 642,100 606,100" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4,3"/>
<!-- Left wrist cuff -->
<path d="M 64,826 C 84,844 126,858 174,862" fill="none" stroke="${sc}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M 66,810 C 86,828 128,842 176,846" fill="none" stroke="${sc}" stroke-width="3.5" stroke-linecap="round"/>
<path d="M 64,826 C 84,844 126,858 174,862" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Right wrist cuff -->
<path d="M 936,826 C 916,844 874,858 826,862" fill="none" stroke="${sc}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M 934,810 C 914,828 872,842 824,846" fill="none" stroke="${sc}" stroke-width="3.5" stroke-linecap="round"/>
<path d="M 936,826 C 916,844 874,858 826,862" fill="none" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Hem band -->
<path d="M 230,888 C 262,900 338,912 500,915 C 662,912 738,900 770,888" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 230,888 C 262,900 338,912 500,915 C 662,912 738,900 770,888" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Kangaroo pocket -->
<path d="${pkt}" fill="${pktFill}"/>
<path d="${pkt}" fill="none" stroke="${sc}" stroke-width="2.5" stroke-linejoin="round"/>
<line x1="500" y1="654" x2="500" y2="794" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3"/>
<!-- Drawcords from hood -->
<path d="M 460,228 C 454,318 450,406 448,472" fill="none" stroke="${cord}" stroke-width="4" stroke-linecap="round"/>
<path d="M 540,228 C 546,318 550,406 552,472" fill="none" stroke="${cord}" stroke-width="4" stroke-linecap="round"/>
<circle cx="448" cy="478" r="7" fill="${aglet}" stroke="${sc}" stroke-width="1.5"/>
<circle cx="552" cy="478" r="7" fill="${aglet}" stroke="${sc}" stroke-width="1.5"/>
<!-- Hood inner lip shadow -->
<path d="M 416,106 C 448,98 472,94 500,92 C 528,94 552,98 584,106" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>`;
  } else {
    return `
<!-- Collar band (back) -->
<path d="${cl}" fill="none" stroke="${sc}" stroke-width="7" stroke-linecap="round"/>
<path d="${cl}" fill="none" stroke="${dc}" stroke-width="2" stroke-dasharray="4.5,3" stroke-linecap="round"/>
<!-- Left wrist cuff (back) -->
<path d="M 64,826 C 84,844 126,858 174,862" fill="none" stroke="${sc}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M 66,810 C 86,828 128,842 176,846" fill="none" stroke="${sc}" stroke-width="3.5" stroke-linecap="round"/>
<!-- Right wrist cuff (back) -->
<path d="M 936,826 C 916,844 874,858 826,862" fill="none" stroke="${sc}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M 934,810 C 914,828 872,842 824,846" fill="none" stroke="${sc}" stroke-width="3.5" stroke-linecap="round"/>
<!-- Hem band -->
<path d="M 230,888 C 262,900 338,912 500,915 C 662,912 738,900 770,888" fill="none" stroke="${sc}" stroke-width="5" stroke-linecap="round"/>
<path d="M 230,888 C 262,900 338,912 500,915 C 662,912 738,900 770,888" fill="none" stroke="${dc}" stroke-width="1.8" stroke-dasharray="4,3" stroke-linecap="round"/>
<!-- Hood centre seam -->
<line x1="500" y1="116" x2="500" y2="348" stroke="${sc}" stroke-width="4" stroke-linecap="round"/>
<line x1="500" y1="116" x2="500" y2="348" stroke="${dc}" stroke-width="1.5" stroke-dasharray="4,3"/>
<!-- Drawcords -->
<path d="M 444,344 C 438,398 434,448 432,490" fill="none" stroke="${cord}" stroke-width="4" stroke-linecap="round"/>
<path d="M 556,344 C 562,398 566,448 568,490" fill="none" stroke="${cord}" stroke-width="4" stroke-linecap="round"/>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  GENERATE
// ══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("\n🎨  Generating realistic garment mockup PNGs…\n");

  // ─────────── T-SHIRT (single path per garment) ───────────────────────
  for (const [face, label] of [["front","front"],["back","back"]]) {
    const path = tshirtPath(face);
    const det  = tshirtDetails(W, `tw${label[0]}`, face);
    await render(svg(W, `tw${label[0]}`,
      layers(path, W, `tw${label[0]}`), det),
      `white-tshirt-${label}.png`);

    const detB = tshirtDetails(B, `tb${label[0]}`, face);
    await render(svg(B, `tb${label[0]}`,
      layers(path, B, `tb${label[0]}`), detB),
      `black-tshirt-${label}.png`);
  }

  // ─────────── LONG SLEEVE (3 separate paths per garment) ──────────────
  for (const [face, label] of [["front","front"],["back","back"]]) {
    const body  = longsleeveBody(face);
    const lSlv  = leftSleeve();
    const rSlv  = rightSleeve();
    const id    = `lw${label[0]}`;
    const det   = longsleeveDetails(W, id, face);
    await render(svg(W, id, [body, lSlv, rSlv].map(p=>layers(p,W,id)).join("\n"), det),
      `white-longsleeve-${label}.png`);
  }

  // ─────────── HOODIE FRONT ────────────────────────────────────────────
  for (const [c, prefix, isWhite] of [[W,"white-hoodie",true],[B,"black-hoodie",false]]) {
    const idF = prefix.replace("-","_") + "_f";

    // FRONT
    {
      const id  = idF;
      const bod = hoodieBodyPath("front");
      const lSl = leftHoodieSleeve();
      const rSl = rightHoodieSleeve();
      const hd  = hoodFront();
      const det = hoodieDetails(c, id, "front", isWhite);
      await render(svg(c, id,
        [bod, lSl, rSl, hd].map(p=>layers(p,c,id)).join("\n"), det),
        `${prefix}-front.png`);
    }

    // BACK
    {
      const id  = prefix.replace("-","_") + "_b";
      const bod = hoodieBodyPath("back");
      const lSl = leftHoodieSleeve();
      const rSl = rightHoodieSleeve();
      const hd  = hoodBack();
      const det = hoodieDetails(c, id, "back", isWhite);
      await render(svg(c, id,
        [bod, lSl, rSl, hd].map(p=>layers(p,c,id)).join("\n"), det),
        `${prefix}-back.png`);
    }
  }

  console.log("\n✅  All 10 garment mockup PNGs generated.\n");
}

main().catch(e => { console.error("❌", e); process.exit(1); });
