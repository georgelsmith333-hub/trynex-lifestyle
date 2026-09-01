/* ═══════════════════════════════════════════════════════
   GARMENT MOCKUPS — photographic templates
   All products use a unified 1000×1000 coordinate space.
   The mockup PNGs live in /public/mockups/<id>-?face?.png
════════════════════════════════════════════════════════ */

import { createSmartMockupManifest, type SmartMockupManifest } from "./smart-mockup-manifest";
import { getCanonicalMockupSpec, type MockupFamily } from "./canonical-mockup-spec";
import { COMPLETE_MOCKUP_MATRIX, getCompleteMockupEntry, type CompleteMockupFamily, type CompleteMockupView } from "./complete-mockup-matrix";
import { ACCEPTED_SMART_V8_RELEASE } from "./smart-v8-release";
import { acceptSmartV9Release, type AcceptedSmartV9Release, type SmartV9CandidateRelease } from "./smart-v9-release";
import { SMART_V9_CANDIDATE } from "./smart-v9-candidate.generated";
import type { PsdMaterialEffectLayer } from "./composer";
import {
  PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE,
  isPsdDerivedTshirtCustomerReleaseSurface,
} from "./psd-derived-tshirt";
import { WATER_BOTTLE_V11_RUNTIME_CANDIDATE } from "./waterbottle-v11-runtime-candidate";
import { getSourceMatrixV3Entry, isSourceMatrixV3Family } from "./source-matrix-v3";
import { getSourceMatrixV4LongSleeveEntry } from "./source-matrix-v4";

// ── T-Shirt: unified studio photos from normalized/ folder ──
const tshirtFront       = "/mockups/smart-v4/tshirt/white/front.png";
const tshirtBack        = "/mockups/smart-v4/tshirt/white/back.png";
const longsleeveFront   = "/mockups/source-matrix-v4/longsleeve/white/front.jpg";
const longsleeveBack    = "/mockups/source-matrix-v4/longsleeve/white/back.jpg";
const hoodieFront       = "/mockups/source-matrix-v3/hoodie/white/front.jpg";
const hoodieBack        = "/mockups/source-matrix-v3/hoodie/white/back.jpg";
const mugFront          = "/mockups/smart-v4/mug/white/front.png";
const mugBack           = "/mockups/smart-v4/mug/white/back.png";
const capFront          = "/mockups/smart-v4/cap/white/front.png";
const capBack           = "/mockups/smart-v4/cap/white/back.png";
const waterBottleFront  = WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.front.url;

// All active color and view assets resolve through the accepted smart-v9 matrix.
// Older roots remain only as fail-closed compatibility fallbacks.

/** A single available garment colour (name + hex). */
export interface ProductColor { name: string; hex: string }

export type ProductType =
  | "tshirt"
  | "mug"
  | "hoodie"
  | "cap"
  | "longsleeve"
  | "waterbottle"
  | "watertumbler";

/** All possible design zones — front/back are garment views; sleeve/neck are flat templates. */
export type Face =
  | "front"
  | "back"
  | "left-sleeve"
  | "right-sleeve"
  | "neck-label";

export type PrintZoneShape = "rect" | "mug-front-body" | "mug-back-body" | "mug-wrap-body" | "cap-front" | "bottle-body";

export interface PrintZone {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Optional silhouette-aware clipping path. The rectangle remains the
   * placement/warning bounds; the shape is the final printable boundary.
   */
  shape?: PrintZoneShape;
}

export interface DesignProduct {
  id: ProductType;
  name: string;
  icon: string;
  category: "tshirt" | "mug" | "hoodie" | "cap" | "longsleeve" | "waterbottle";
  garmentColor: string;
  /** Available garment colours for this product type. */
  colors: ProductColor[];
  description: string;
  badge?: string;
  viewBox: string;
  aspect: number;
  printZone: PrintZone;
  printZoneBack?: PrintZone;
  baseHeight: number;
  frontSrc: string;
  /** Optional photographic gallery preview; never used for print-zone geometry. */
  gallerySrc?: string;
  backSrc?: string;
}

/* ── Per-zone print zones ─────────────────────────────────
   All in the unified 1000×1000 viewBox.
   Calibrated against actual product mockup photography.

   Front zones are the standard chest / body print area.
   Back zones are larger (no collar notch) and start higher.
   Hoodie front is intentionally short — stops before kangaroo pocket.

   Garment zones:
     TSHIRT_PZ / _BACK_PZ      — t-shirt front / back
     LONGSLEEVE_PZ / _BACK_PZ  — long-sleeve front / back
     HOODIE_PZ / _BACK_PZ      — hoodie front (above pocket) / back
     CAP_PZ / CAP_BACK_PZ      — cap front / rear crown panel
   Flat-template zones (no garment image):
     SLEEVE_PZ      — left-sleeve and right-sleeve
     NECK_LABEL_PZ  — neck-label
   Drinkware zones:
     MUG_SIDE_PZ    — single-side editing, front/left-handle view
     MUG_SIDE_BACK_PZ — mirrored single-side editing, back/right-handle view
     MUG_PZ         — full 360° wrap
     WATERBOTTLE_PZ — bottle body (cylindrical section)
──────────────────────────────────────────────────────── */
export const TSHIRT_PZ: PrintZone           = { x: 240, y: 185, w: 520, h: 580 };
export const TSHIRT_BACK_PZ: PrintZone      = { x: 240, y: 185, w: 520, h: 580 };
export const LONGSLEEVE_PZ: PrintZone       = { x: 336.5, y: 327.25, w: 308.75, h: 266.5 };
export const LONGSLEEVE_BACK_PZ: PrintZone  = { x: 328.5, y: 366.25, w: 328.75, h: 86.25 };
/** Hoodie front — lowered and sized to sit below the drawstrings and above the kangaroo pocket. */
export const HOODIE_PZ: PrintZone           = { x: 171.75, y: 121.25, w: 677, h: 737 };
export const HOODIE_BACK_PZ: PrintZone      = { x: 172, y: 123.75, w: 679.5, h: 733.25 };
/** Cap front panel — structured 5-panel cap, panel is centred between brim and seam. */
export const CAP_PZ: PrintZone              = { x: 240, y: 260, w: 540, h: 320, shape: "cap-front" };
/** Cap rear crown zone — deliberately stops above the adjustment opening and strap. */
export const CAP_BACK_PZ: PrintZone         = { x: 285, y: 270, w: 430, h: 230 };
/** Full Wrap uses the continuous printable body band and is an explicit mode. */
export const MUG_PZ: PrintZone              = { x: 165, y: 220, w: 670, h: 580, shape: "mug-wrap-body" };
export const MUG_WRAP_BACK_PZ: PrintZone    = MUG_PZ;
/**
 * Side 1 / Side 2 use mirrored body-safe geometry. The reviewed mug photos
 * place the handle on opposite sides, so each side has its own body boundary.
 * This keeps the larger sublimation area while stopping at the actual handle
 * wall instead of relying on a colour-dependent arbitrary inset.
 */
export const MUG_SIDE_PZ: PrintZone         = { x: 165, y: 220, w: 475, h: 580, shape: "mug-front-body" };
export const MUG_SIDE_BACK_PZ: PrintZone    = { x: 384, y: 220, w: 451, h: 580, shape: "mug-back-body" };
/** Water bottle label panel: only the straight aluminium body is printable;
 * the lid, shoulder, carabiner and rounded base are intentionally excluded. */
// Supplied key-ring bottle reference: body begins below the shoulder and ends above
// the rounded foot. The loop/carabiner and shoulder are intentionally outside.
export const WATERBOTTLE_PZ: PrintZone      = { x: 335, y: 320, w: 276, h: 590, shape: "bottle-body" };
/** Sleeve print area — roughly square (1228×1087px real-world ratio). */
export const SLEEVE_PZ: PrintZone           = { x: 175, y: 175, w: 650, h: 650 };
/** Neck label — wider than tall (1299×945px real-world ratio). */
export const NECK_LABEL_PZ: PrintZone       = { x: 150, y: 265, w: 700, h: 470 };

export const WATERBOTTLE_MOCKUP_URL = waterBottleFront;

/* ── Zone configuration ─────────────────────────────────── */
export interface ApparelZone {
  face: Face;
  label: string;
  shortLabel: string;
  /** Indicative print resolution dimensions shown to the designer. */
  pxDimensions: string;
  pz: PrintZone;
  /** Whether this zone uses a flat-template canvas (no garment photo). */
  isFlat: boolean;
}

const FRONT_BACK_DIMS = "4606 × 5787 px";
const SLEEVE_DIMS = "1228 × 1087 px";
const NECK_DIMS = "1299 × 945 px";

/** Returns the ordered print zones for a given product category. */
export function getApparelZones(
  category: DesignProduct["category"],
  productPZ?: PrintZone,
  productBackPZ?: PrintZone,
  colourHex?: string,
): ApparelZone[] {
  const frontPZ = productPZ ?? TSHIRT_PZ;
  const backPZ  = productBackPZ ?? frontPZ;
  const sourceColour = colourHex ? SOURCE_KIT_COLOR_SLUGS[category]?.[normalizeMockupHex(colourHex)] : undefined;
  const sourceMatrix = sourceColour
    ? (face: CompleteMockupView) => getApprovedSourceMatrixEntry(category, sourceColour, face)?.printZone
    : undefined;
  switch (category) {
    case "tshirt":
    case "longsleeve":
    case "hoodie":
      return [
        { face: "front",       label: "Front",        shortLabel: "Front",  pxDimensions: FRONT_BACK_DIMS, pz: sourceMatrix?.("front") ?? frontPZ,   isFlat: false },
        { face: "back",        label: "Back",         shortLabel: "Back",   pxDimensions: FRONT_BACK_DIMS, pz: sourceMatrix?.("back") ?? backPZ,    isFlat: false },
        { face: "left-sleeve", label: "Left Sleeve",  shortLabel: "L.Sleeve", pxDimensions: SLEEVE_DIMS,  pz: sourceMatrix?.("left-sleeve") ?? SLEEVE_PZ, isFlat: true  },
        { face: "right-sleeve",label: "Right Sleeve", shortLabel: "R.Sleeve", pxDimensions: SLEEVE_DIMS,  pz: sourceMatrix?.("right-sleeve") ?? SLEEVE_PZ, isFlat: true  },
        { face: "neck-label",  label: "Neck Label",   shortLabel: "Neck",   pxDimensions: NECK_DIMS,      pz: sourceMatrix?.("neck-label") ?? NECK_LABEL_PZ, isFlat: true },
      ];
    default:
      return [
        { face: "front", label: "Front", shortLabel: "Front", pxDimensions: FRONT_BACK_DIMS, pz: frontPZ, isFlat: false },
      ];
  }
}

/** Get the print zone for a given face and product (used by DesignStudio). */
export function getZonePZ(face: Face, product: DesignProduct, colourHex?: string): PrintZone {
  if (product.category === "mug") return face === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ;
  const sourceColour = colourHex ? SOURCE_KIT_COLOR_SLUGS[product.category]?.[normalizeMockupHex(colourHex)] : undefined;
  if (isSourceMatrixV3Family(product.category) && sourceColour) {
    const sourceZone = getSourceMatrixV3Entry(product.category, sourceColour, face)?.printZone;
    if (sourceZone) return sourceZone;
  }
  if (face === "left-sleeve" || face === "right-sleeve") return SLEEVE_PZ;
  if (face === "neck-label") return NECK_LABEL_PZ;
  if (face === "back" && product.printZoneBack) return product.printZoneBack;
  return product.printZone;
}

const VIEWBOX = "0 0 1000 1000";
const ASPECT = 1;
const BASE = 1000;

export const PRODUCTS: DesignProduct[] = [
  {
    id: "tshirt", name: "Unisex T-Shirt", icon: "👕", category: "tshirt",
    garmentColor: "#F5F5F3",
    colors: [
      { name: "White",    hex: "#F8F7F4" }, { name: "Black",    hex: "#1a1a1a" },
      { name: "Navy",     hex: "#1e3a5f" }, { name: "Maroon",   hex: "#7f1d1d" },
      { name: "Olive",    hex: "#4a5240" }, { name: "Sky Blue", hex: "#0ea5e9" },
      { name: "Grey",     hex: "#6b7280" }, { name: "Red",      hex: "#dc2626" },
    ],
    description: "230GSM Cotton", badge: "Best Seller",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: TSHIRT_PZ, printZoneBack: TSHIRT_BACK_PZ,
    frontSrc: tshirtFront, gallerySrc: "/mockups/gallery-v1/tshirt-white-front.png", backSrc: tshirtBack,
  },
  {
    id: "longsleeve", name: "Unisex Long Sleeve", icon: "👔", category: "longsleeve",
    garmentColor: "#F5F5F3",
    colors: [
      { name: "White",        hex: "#F5F5F3" }, { name: "Black",        hex: "#1a1a1a" },
      { name: "Charcoal",     hex: "#303030" }, { name: "Heather Grey", hex: "#a3a3a3" },
      { name: "Navy",         hex: "#1e3a5f" }, { name: "Royal Blue",   hex: "#2563eb" },
      { name: "Forest Green", hex: "#166534" }, { name: "Burgundy",     hex: "#6b1a2c" },
      { name: "Red",          hex: "#dc2626" }, { name: "Sand",         hex: "#d2bd88" },
    ],
    description: "240GSM Cotton",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: LONGSLEEVE_PZ, printZoneBack: LONGSLEEVE_BACK_PZ,
    frontSrc: longsleeveFront, gallerySrc: "/mockups/gallery-v1/longsleeve-white-front.png", backSrc: longsleeveBack,
  },
  {
    id: "hoodie", name: "Unisex Hoodie", icon: "🧥", category: "hoodie",
    garmentColor: "#F2EFE9",
    colors: [
      { name: "White / Red Trim", hex: "#F2EFE9" }, { name: "Black",        hex: "#1a1a1a" },
      { name: "Charcoal",        hex: "#303030" }, { name: "Heather Grey", hex: "#a3a3a3" },
      { name: "Navy",            hex: "#1e3a5f" }, { name: "Royal Blue",   hex: "#2563eb" },
      { name: "Forest Green",    hex: "#166534" }, { name: "Burgundy",     hex: "#6b1a2c" },
      { name: "Red",             hex: "#dc2626" }, { name: "Sand",         hex: "#d2bd88" },
    ],
    description: "320GSM Fleece", badge: "New",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: HOODIE_PZ, printZoneBack: HOODIE_BACK_PZ,
    frontSrc: hoodieFront, gallerySrc: "/mockups/gallery-v1/hoodie-white-front.png", backSrc: hoodieBack,
  },
  {
    id: "mug", name: "Coffee Mug", icon: "☕", category: "mug",
    garmentColor: "#F5F5F5",
    colors: [
      { name: "White",    hex: "#F5F5F5" }, { name: "Black",    hex: "#1C1917" },
      { name: "Navy",     hex: "#1e3a5f" }, { name: "Red",      hex: "#dc2626" },
      { name: "Green",    hex: "#16a34a" }, { name: "Purple",   hex: "#7c3aed" },
      { name: "Sky Blue", hex: "#0ea5e9" }, { name: "Pink",     hex: "#ec4899" },
      { name: "Maroon",   hex: "#7f1d1d" }, { name: "Orange",   hex: "#ea580c" },
    ],
    description: "11oz Ceramic", badge: "Popular",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: MUG_SIDE_PZ,
    frontSrc: mugFront, gallerySrc: "/mockups/gallery-v1/mug-white-front.png", backSrc: mugBack,
  },
  {
    id: "cap", name: "Structured Cap", icon: "🧢", category: "cap",
    garmentColor: "#F5F2EC",
    colors: [
      { name: "White",  hex: "#F5F2EC" }, { name: "Black",  hex: "#1a1a1a" },
      { name: "Navy",   hex: "#1e3a5f" }, { name: "Maroon", hex: "#7f1d1d" },
      { name: "Olive",  hex: "#4a5240" }, { name: "Red",    hex: "#dc2626" },
      { name: "Grey",   hex: "#6b7280" }, { name: "Forest", hex: "#166534" },
    ],
    description: "Cotton Twill",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: CAP_PZ, printZoneBack: CAP_BACK_PZ,
    frontSrc: capFront, gallerySrc: "/mockups/gallery-v1/cap-white-front.png", backSrc: capBack,
  },
  {
    id: "waterbottle", name: "Water Bottle", icon: "🥤", category: "waterbottle",
    garmentColor: "#F4F3F1",
    // The supplied product is a white sublimation-coated aluminium blank. A
    // swatch would falsely imply a colored body and unsupported substrate.
    colors: [
      { name: "White Sublimation Blank", hex: "#F4F3F1" },
    ],
    description: "600ml White Sublimation Aluminium",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: WATERBOTTLE_PZ,
    frontSrc: WATERBOTTLE_MOCKUP_URL,
    gallerySrc: WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.front.url,
    backSrc: WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.back.url,
  },
  // NOTE: Water Tumbler removed — it was a duplicate of Water Bottle with identical
  // mockup, colors, and print zone. Re-add if a distinct tumbler mockup is provided.
];

/* ═══════════════════════════════════════════════════════
   GARMENT RENDERER — embeds the mockup PNG inside the
   parent <svg viewBox="0 0 1000 1000"> as an SVG <image>.

   MUG SPECIAL HANDLING:
   • Left Side (face="front"): normal image, handle visible on right.
   • Right Side (face="back") : image flipped horizontally so handle
     appears on the left — this represents the opposite side of the mug
     as seen from outside.
════════════════════════════════════════════════════════ */

export const BASE_BY_CATEGORY: Record<
  DesignProduct["category"],
  { front: string; back?: string; frontCutout?: string; backCutout?: string; } | undefined
> = {
  tshirt:      { front: tshirtFront, back: tshirtBack, frontCutout: tshirtFront, backCutout: tshirtBack },
  longsleeve:  { front: longsleeveFront, back: longsleeveBack, frontCutout: longsleeveFront, backCutout: longsleeveBack },
  hoodie:      { front: hoodieFront, back: hoodieBack, frontCutout: hoodieFront, backCutout: hoodieBack },
  mug:         { front: mugFront, back: mugBack, frontCutout: mugFront, backCutout: mugBack },
  cap:         { front: capFront, back: capBack, frontCutout: capFront, backCutout: "/mockups/smart-v4/cap/white/back.png" },
  waterbottle: {
    front: waterBottleFront,
    back: WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.back.url,
    frontCutout: waterBottleFront,
    backCutout: WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.back.url,
  },
  // watertumbler uses category "waterbottle" — shares the same base entry
};

/**
 * Runtime catalog generated from the editable source-kit manifest.
 *
 * Editable PSD masters stay in attached_assets as source material. The
 * browser deliberately uses the linked PNG preview/cutout pair because PSDs
 * are not browser-renderable. Every source-kit resolution carries the exact
 * master path and manifest key so export/admin tooling can round-trip the
 * same product, color, face, and print-zone contract without guessing.
 */
const SOURCE_KIT_COLOR_SLUGS: Record<
  DesignProduct["category"],
  Record<string, string>
> = {
  tshirt: {
    "#f8f7f4": "white", "#1a1a1a": "black", "#1e3a5f": "navy",
    "#7f1d1d": "maroon", "#4a5240": "olive", "#0ea5e9": "sky-blue",
    "#6b7280": "grey", "#dc2626": "red",
  },
  longsleeve: {
    "#f5f5f3": "white", "#1a1a1a": "black", "#303030": "charcoal",
    "#a3a3a3": "heather-grey", "#1e3a5f": "navy", "#2563eb": "royal-blue",
    "#166534": "forest-green", "#6b1a2c": "burgundy", "#dc2626": "red",
    "#d2bd88": "sand",
  },
  hoodie: {
    "#f2efe9": "white", "#1a1a1a": "black", "#303030": "charcoal",
    "#a3a3a3": "heather-grey", "#1e3a5f": "navy", "#2563eb": "royal-blue",
    "#166534": "forest-green", "#6b1a2c": "burgundy", "#dc2626": "red",
    "#d2bd88": "sand",
  },
  mug: {
    "#f5f5f5": "white", "#1c1917": "black", "#1e3a5f": "navy",
    "#dc2626": "red", "#16a34a": "green", "#7c3aed": "purple",
    "#0ea5e9": "sky-blue", "#ec4899": "pink", "#7f1d1d": "maroon",
    "#ea580c": "orange",
  },
  cap: {
    "#f5f2ec": "white", "#1a1a1a": "black", "#1e3a5f": "navy",
    "#7f1d1d": "maroon", "#4a5240": "olive", "#dc2626": "red",
    "#6b7280": "grey", "#166534": "forest",
  },
  waterbottle: {
    // White sublimation-coated aluminium blank. Additional literal bottle colors
    // require their own physical masters and are intentionally not synthesized.
    "#f4f3f1": "white",
  },
};

/**
 * The staged release uses the older canonical color vocabulary for hoodies and
 * long sleeves. Only exact product-color matches are allowed at the runtime
 * asset boundary; an ambiguous shade must use its reviewed color-specific
 * source-matrix asset rather than silently showing the wrong garment color.
 */
const SMART_V9_EXACT_COLOR_SLUGS: Record<"longsleeve" | "hoodie", Readonly<Record<string, string>>> = {
  longsleeve: {
    white: "white",
    black: "black",
    "heather-grey": "grey",
    navy: "navy",
    "forest-green": "forest",
    burgundy: "burgundy",
    red: "red",
  },
  hoodie: {
    white: "white",
    black: "black",
    "heather-grey": "grey",
    navy: "navy",
    "forest-green": "forest",
    burgundy: "burgundy",
    red: "red",
  },
};

export function getSmartV9ColorSlug(category: DesignProduct["category"], sourceKitSlug: string): string | undefined {
  if (category !== "longsleeve" && category !== "hoodie") return sourceKitSlug;
  return SMART_V9_EXACT_COLOR_SLUGS[category][sourceKitSlug];
}

const SOURCE_KIT_PRINT_ZONES: Record<
  DesignProduct["category"],
  { front: PrintZone; back: PrintZone }
> = {
  tshirt: {
    front: { x: 240, y: 185, w: 520, h: 580 },
    back: { x: 240, y: 185, w: 520, h: 580 },
  },
  longsleeve: {
    front: { x: 312, y: 222, w: 376, h: 404 },
    back: { x: 292, y: 195, w: 416, h: 458 },
  },
  hoodie: {
    front: { x: 240, y: 270, w: 520, h: 400 },
    back: { x: 292, y: 184, w: 416, h: 448 },
  },
  mug: {
    front: MUG_SIDE_PZ,
    back: MUG_SIDE_BACK_PZ,
  },
  cap: {
    front: { x: 240, y: 260, w: 540, h: 320 },
    back: { x: 285, y: 270, w: 430, h: 230 },
  },
  waterbottle: {
    front: { x: 335, y: 320, w: 276, h: 590, shape: "bottle-body" },
    back: { x: 335, y: 320, w: 276, h: 590, shape: "bottle-body" },
  },
};

const SOURCE_KIT_FRAMES: Record<
  DesignProduct["category"],
  { front: NormalizedMockupFrame; back: NormalizedMockupFrame }
> = {
  // Values measured from actual normalized photos (scripts/normalize_mockups_v3.py).
  // Each product uses one shared frame across faces and colors so switching
  // view or color cannot change the apparent product scale or position.
  tshirt: {
    front: { canvasWidth: 1024, canvasHeight: 1024, x: 43, y: 66, w: 937, h: 891 },
    back:  { canvasWidth: 1024, canvasHeight: 1024, x: 43, y: 66, w: 937, h: 891 },
  },
  longsleeve: {
    front: { canvasWidth: 1024, canvasHeight: 1024, x: 53, y: 94, w: 917, h: 836 },
    back:  { canvasWidth: 1024, canvasHeight: 1024, x: 53, y: 94, w: 917, h: 836 },
  },
  hoodie: {
    front: { canvasWidth: 1024, canvasHeight: 1024, x: 54, y: 43, w: 916, h: 937 },
    back:  { canvasWidth: 1024, canvasHeight: 1024, x: 54, y: 43, w: 916, h: 937 },
  },
  mug: {
    front: { canvasWidth: 1024, canvasHeight: 1024, x: 143, y: 192, w: 738, h: 637 },
    back:  { canvasWidth: 1024, canvasHeight: 1024, x: 143, y: 192, w: 738, h: 637 },
  },
  cap: {
    front: { canvasWidth: 1024, canvasHeight: 1024, x: 162, y: 184, w: 700, h: 655 },
    back:  { canvasWidth: 1024, canvasHeight: 1024, x: 162, y: 184, w: 700, h: 655 },
  },
  waterbottle: {
    front: { canvasWidth: 1024, canvasHeight: 1024, x: 351, y: 78, w: 322, h: 866 },
    back:  { canvasWidth: 1024, canvasHeight: 1024, x: 351, y: 78, w: 322, h: 866 },
  },
};

export interface MockupResolution {
  /** Normalized selected colour used only by fallback tint consumers. */
  colorHex: string;
  /** Source-controlled browser runtime asset used by every surface. */
  photoSrc: string;
  /** Alias retained for backward-compatible compositor contracts. */
  cutoutSrc: string;
  /** True when the selected photo is already the exact requested product colour. */
  isColorPhoto: boolean;
  /** Legacy alias for requiresTint; kept for persisted/cart compatibility. */
  cutoutNeedsTint: boolean;
  /** The photo/cutout opacity contract. */
  photoKind: "opaque-photo" | "transparent-cutout";
  /** Whether the selected transparent source needs SVG/Canvas colour application. */
  requiresTint: boolean;
  /** Silhouette shadows are safe only for transparent sources. */
  allowSilhouetteShadow: boolean;
  /** Exact source-kit print zone when this color/face exists. */
  printZone: PrintZone;
  /** Normalized 1024px frame used by 2D and 3D consumers. */
  normalizedFrame: NormalizedMockupFrame;
  /** True only when a future opaque photographic override is explicitly active. */
  isOpaquePhoto: boolean;
  /** Repository-relative editable master generated from the same source kit. */
  editableMasterPath?: string;
  /** Stable source-kit document key used by export/admin tooling. */
  sourceKitKey?: string;
  /** Explicit PSD/PSB smart-object recipe used by compositor/export tooling. */
  smartObject: SmartMockupManifest;
  /** Reviewed raster effects for the isolated PSD-derived T-shirt release only. */
  psdMaterialEffects?: readonly PsdMaterialEffectLayer[];
  source: "source-kit" | "curated";
}

export interface NormalizedMockupFrame {
  canvasWidth: number;
  canvasHeight: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RuntimeMockupOverride {
  sourceKitKey: string;
  imageUrl: string;
  masterFileUrl?: string | null;
  ingestionStatus: "ready";
}

const runtimeMockupOverrides = new Map<string, RuntimeMockupOverride>();

/**
 * A release is deliberately inactive until every canonical surface has supplied
 * a reviewed asset URL and both visual and technical gates have passed.
 */
export interface SmartV8ReleaseAcceptance {
  version: "smart-v8";
  assetUrls: Record<string, string>;
  visualGatePassed: boolean;
  technicalGatePassed: boolean;
}

const REQUIRED_SMART_V8_SURFACE_KEYS = COMPLETE_MOCKUP_MATRIX.map((entry) => entry.sourceKey);
let acceptedSmartV8Release: SmartV8ReleaseAcceptance | null = null;
let acceptedSmartV9Release: AcceptedSmartV9Release | null = null;

export function activateSmartV8Release(acceptance: SmartV8ReleaseAcceptance): void {
  if (!acceptance.visualGatePassed || !acceptance.technicalGatePassed) {
    throw new Error("smart-v8 cannot activate before visual and technical acceptance.");
  }
  const suppliedKeys = Object.keys(acceptance.assetUrls);
  if (suppliedKeys.length !== REQUIRED_SMART_V8_SURFACE_KEYS.length) {
    throw new Error(`smart-v8 requires ${REQUIRED_SMART_V8_SURFACE_KEYS.length} accepted surfaces; received ${suppliedKeys.length}.`);
  }
  for (const key of REQUIRED_SMART_V8_SURFACE_KEYS) {
    const url = acceptance.assetUrls[key];
    if (!url || url.includes("smart-v7")) {
      throw new Error(`smart-v8 asset is missing or invalid for ${key}.`);
    }
  }
  acceptedSmartV8Release = acceptance;
}

/** Smart-v9 stays inert until its full candidate manifest passes the stricter gate. */
export function activateSmartV9Release(candidate: SmartV9CandidateRelease): void {
  acceptedSmartV9Release = acceptSmartV9Release(candidate);
}

export function getActiveMockupReleaseVersion(): "smart-v4" | "smart-v8" | "smart-v9" {
  if (acceptedSmartV9Release) return "smart-v9";
  return acceptedSmartV8Release ? "smart-v8" : "smart-v4";
}

/**
 * Product picker thumbnails remain on their curated gallery assets until a
 * complete smart-v9 release is explicitly accepted. Once v9 is active, the
 * picker moves to the same accepted white-front surface as the Studio canvas
 * and never falls back to an older release if that v9 asset fails to load.
 */
export function getProductPickerPreviewSrc(product: DesignProduct): string {
  if (product.category === "waterbottle") return WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.front.url;
  if (!acceptedSmartV9Release) return product.gallerySrc ?? product.frontSrc;
  const baseColor = product.colors[0]?.hex ?? product.garmentColor;
  return getCuratedMockup(product, baseColor, "front").photoSrc;
}

export function getProductPickerFallbackSrc(product: DesignProduct): string | undefined {
  return acceptedSmartV9Release ? undefined : product.frontSrc;
}

// These generated assets were promoted from the validated staging matrix. The
// all-or-nothing guard above remains the sole activation path.
activateSmartV8Release(ACCEPTED_SMART_V8_RELEASE);
activateSmartV9Release(SMART_V9_CANDIDATE);

function normalizeRuntimeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\\/]+/g, ":");
}

/** Replace only an explicitly approved visual source; canonical geometry stays local. */
export function setRuntimeMockupOverrides(overrides: RuntimeMockupOverride[]): void {
  runtimeMockupOverrides.clear();
  for (const override of overrides) {
    if (override.ingestionStatus !== "ready" || !override.sourceKitKey || !override.imageUrl) continue;
    const normalizedKey = normalizeRuntimeKey(override.sourceKitKey);
    // Water Bottle v1.1 is a reviewed two-face, hash-pinned browser contract.
    // Older gallery records still reference smart-v4 and must never override it
    // merely because their ingestion status is "ready". Permit only the exact
    // reviewed v1.1 URL for the face encoded in the metadata key.
    if (normalizedKey.startsWith("waterbottle:")) {
      const expectedUrl = normalizedKey.endsWith(":back")
        ? WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.back.url
        : WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.front.url;
      if (override.imageUrl !== expectedUrl) continue;
    }
    // Reviewed PSD-derived T-shirt Front/Back bases are authoritative for the
    // colour/face matrix they actually cover. Older gallery records point at
    // green-contaminated smart-v4 files and otherwise take precedence merely
    // because their ingestion status is "ready".
    if (normalizedKey.startsWith("tshirt:")) {
      const [, colorSlug, face] = normalizedKey.split(":");
      const isReviewedFace = face === "front" || face === "back";
      if (colorSlug && isReviewedFace && isPsdDerivedTshirtCustomerReleaseSurface(colorSlug, face)) {
        const expectedUrl = `${PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.assetRoot}/${colorSlug}/${face}.png`;
        if (override.imageUrl !== expectedUrl) continue;
      }
    }
    runtimeMockupOverrides.set(normalizedKey, override);
  }
}

/**
 * Return the canonical printable silhouette in the same 1000×1000
 * coordinate system used by the editor and SVG mockups.
 *
 * Mug side panels are deliberately asymmetric because the source photos put
 * the handle on opposite sides. The upper and lower curves preserve a stable
 * ceramic-body margin instead of cutting artwork with a hard horizontal edge.
 */
export function printZonePath(zone: PrintZone): string {
  const { x, y, w, h } = zone;
  if (!zone.shape || zone.shape === "rect") {
    return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  }

  const topInset = Math.min(18, w * 0.04);
  const bottomInset = Math.min(22, w * 0.05);
  const sideRadius = Math.min(24, w * 0.06);
  const top = y + 10;
  const bottom = y + h - 10;
  const left = x + topInset;
  const right = x + w - topInset;
  const cx = x + w / 2;
  const isMugSide = zone.shape === "mug-front-body" || zone.shape === "mug-back-body";

  if (zone.shape === "bottle-body") {
    const shoulder = Math.min(h * 0.12, 54);
    const base = Math.min(h * 0.08, 38);
    const side = Math.min(w * 0.16, 28);
    return [
      `M${x + side} ${y + shoulder}`,
      `Q${x + w / 2} ${y + shoulder * 0.45} ${x + w - side} ${y + shoulder}`,
      `L${x + w - side} ${y + h - base}`,
      `Q${x + w / 2} ${y + h + base * 0.2} ${x + side} ${y + h - base}`,
      "Z",
    ].join(" ");
  }

  if (zone.shape === "cap-front") {
    const crown = Math.min(h * 0.18, 56);
    const side = Math.min(w * 0.12, 34);
    return [
      `M${x + side} ${y + crown}`,
      `Q${x + w / 2} ${y - crown * 0.15} ${x + w - side} ${y + crown}`,
      `L${x + w - side * 0.7} ${y + h - 18}`,
      `Q${x + w / 2} ${y + h + 12} ${x + side * 0.7} ${y + h - 18}`,
      "Z",
    ].join(" ");
  }

  if (isMugSide) {
    return [
      `M${left} ${top}`,
      `Q${cx} ${y - 4} ${right} ${top}`,
      `Q${x + w} ${top + 4} ${x + w} ${top + sideRadius}`,
      `L${x + w} ${bottom - sideRadius}`,
      `Q${x + w} ${bottom - 2} ${right} ${bottom}`,
      `Q${cx} ${y + h + 4} ${left} ${bottom}`,
      `Q${x} ${bottom - 2} ${x} ${bottom - sideRadius}`,
      `L${x} ${top + sideRadius}`,
      `Q${x} ${top + 4} ${left} ${top}`,
      "Z",
    ].join(" ");
  }

  // Wrap is a continuous body band. Keep the explicit wide mode, but retain
  // rounded ceramic top/bottom margins so the texture does not reach the rim
  // or base when it is used by the final compositor and 3D preview.
  return [
    `M${left} ${top}`,
    `Q${cx} ${y - 4} ${right} ${top}`,
    `Q${x + w} ${top + 4} ${x + w} ${top + sideRadius}`,
    `L${x + w} ${bottom - sideRadius}`,
    `Q${x + w} ${bottom - 2} ${right} ${bottom}`,
    `Q${cx} ${y + h + 4} ${left} ${bottom}`,
    `Q${x} ${bottom - 2} ${x} ${bottom - sideRadius}`,
    `L${x} ${top + sideRadius}`,
    `Q${x} ${top + 4} ${left} ${top}`,
    "Z",
  ].join(" ");
}

/**
 * Shared point-in-zone test for print warnings and other non-SVG consumers.
 * The tolerance is intentionally applied outside the shape so the warning
 * remains forgiving at the edge without making the printable body larger.
 */
export function isPrintZonePointInside(zone: PrintZone, px: number, py: number, tolerance = 0): boolean {
  if (
    px < zone.x - tolerance ||
    px > zone.x + zone.w + tolerance ||
    py < zone.y - tolerance ||
    py > zone.y + zone.h + tolerance
  ) {
    return false;
  }
  if (!zone.shape || zone.shape === "rect") return true;

  const top = zone.y + 10;
  const bottom = zone.y + zone.h - 10;
  const sideRadius = Math.min(24, zone.w * 0.06);
  const topInset = Math.min(18, zone.w * 0.04);
  const bottomInset = Math.min(22, zone.w * 0.05);
  const topProgress = Math.max(0, Math.min(1, (py - top) / Math.max(sideRadius, 1)));
  const bottomProgress = Math.max(0, Math.min(1, (bottom - py) / Math.max(sideRadius, 1)));
  const edgeInset = Math.max(
    topInset * (1 - topProgress),
    bottomInset * (1 - bottomProgress),
  );

  return (
    px >= zone.x + edgeInset - tolerance &&
    px <= zone.x + zone.w - edgeInset + tolerance
  );
}

function normalizeMockupHex(hex: string): string {
  return hex.trim().toLowerCase();
}

/**
 * The source-controlled v4 corrective matrix is deliberately limited to Long
 * Sleeve. All other v3-family products retain their independently reviewed v3
 * contracts and assets.
 */
function getApprovedSourceMatrixEntry(
  category: DesignProduct["category"],
  colour: string,
  face: CompleteMockupView,
) {
  if (category === "longsleeve") return getSourceMatrixV4LongSleeveEntry(colour, face);
  return isSourceMatrixV3Family(category) ? getSourceMatrixV3Entry(category, colour, face) : undefined;
}

function colorLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return 1;
  const red = Number.parseInt(normalized.slice(0, 2), 16) || 0;
  const green = Number.parseInt(normalized.slice(2, 4), 16) || 0;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) || 0;
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function getPsdTshirtMaterialEffects(color: string, face: "front" | "back"): readonly PsdMaterialEffectLayer[] {
  const luminance = colorLuminance(color);
  const root = PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.assetRoot;
  const isDarkGarment = luminance < 0.35;

  // The reviewed color-specific bases already contain their garment lighting.
  // A shared white screen map turns dark bases into pale streaked variants in
  // the live preview, so retain only restrained ink shading for those colors.
  return [
    { src: `${root}/effects/${face}-multiply.png`, blendMode: "multiply", opacity: isDarkGarment ? 0.35 : 0.77 },
    { src: `${root}/effects/${face}-screen.png`, blendMode: "screen", opacity: isDarkGarment ? 0 : 0.38 * Math.max(0.1, luminance) },
  ];
}

function canonicalMasterPath(category: DesignProduct["category"], _colorSlug: string, face: CompleteMockupView): string {
  // The attached 22-master package contains one layered PSD/PSB per family/view.
  // Colorways are controlled by the source layer contract and exported into the
  // color-scoped smart-v4 derivatives; the master is therefore view-scoped rather
  // than falsely represented as a nonexistent per-color editable document.
  const familyDir: Record<DesignProduct["category"], string> = {
    tshirt: "TShirt",
    longsleeve: "LongSleeve",
    hoodie: "Hoodie",
    mug: "Mug",
    cap: "Cap",
    waterbottle: "Bottle",
  };
  const extension = category === "mug" || category === "waterbottle" ? "psb" : "psd";
  return `attached_assets/trynex-mockup-source-kit/masters-22-photoreal/masters/${familyDir[category]}/${face}.${extension}`;
}

function findColorPhoto(
  colorPhotos: Record<string, { front: string; back?: string }> | undefined,
  color: string,
): { front: string; back?: string } | undefined {
  if (!colorPhotos) return undefined;
  const normalized = normalizeMockupHex(color);
  return Object.entries(colorPhotos).find(
    ([key]) => normalizeMockupHex(key) === normalized,
  )?.[1];
}

function getCuratedMockup(
  product: DesignProduct,
  color: string,
  face: CompleteMockupView,
): {
  photoSrc: string;
  cutoutSrc: string;
  isColorPhoto: boolean;
  cutoutNeedsTint: boolean;
  photoKind: "opaque-photo" | "transparent-cutout";
  requiresTint: boolean;
  allowSilhouetteShadow: boolean;
} {
  const category = product.category;
  const hex = normalizeMockupHex(color);
  const slug = SOURCE_KIT_COLOR_SLUGS[category]?.[hex] || "white";
  const completeView = getCompleteMockupEntry(category as CompleteMockupFamily, slug, face);
  const smartV9ColorSlug = getSmartV9ColorSlug(category, slug);
  const smartV9SourceKey = smartV9ColorSlug ? `${category}:${smartV9ColorSlug}:${face}` : undefined;
  const cutoutSrc = (smartV9SourceKey ? acceptedSmartV9Release?.assetUrls[smartV9SourceKey] : undefined)
    ?? acceptedSmartV8Release?.assetUrls[completeView.sourceKey]
    ?? (completeView.assetPath + "?v=smart-v4");
  const photoSrc = cutoutSrc;
  return {
    photoSrc,
    cutoutSrc,
    isColorPhoto: false,
    cutoutNeedsTint: false,
    photoKind: "transparent-cutout",
    requiresTint: false,
    // The v3 cutouts already carry product lighting and have clean alpha.
    // Never add a full-frame shadow or duplicate source pass.
    allowSilhouetteShadow: false,
  };
}

/**
 * Resolves one canonical mockup key for every customer-facing surface.
 *
 * Smart-v4 PNGs (public/mockups/smart-v4/*) remain bound for all
 * products, colors, and faces until the complete smart-v8 acceptance contract
 * has passed. Retired smart-v7 assets are never permitted in this renderer.
 *
 * Rendering path summary:
 *   Every family/color/face resolves to one v3 transparent cutout at runtime.
 *   Opaque normalized photos remain metadata/admin references only; they are
 *   never stacked with the cutout in the editor because that creates ghost
 *   silhouettes and pale wedges. Curved products use the same face contract
 *   in the compositor and 3D texture path.
 */
export function resolveMockup(
  product: DesignProduct,
  color: string,
  face: CompleteMockupView = "front",
): MockupResolution {
  const category = product.category;
  const zones = SOURCE_KIT_PRINT_ZONES[category];
  const canonicalSpec = getCanonicalMockupSpec(category as MockupFamily);
  const hex = normalizeMockupHex(color);
  const sourceKitSlug = SOURCE_KIT_COLOR_SLUGS[category]?.[hex] ?? "white";
  const completeView = getCompleteMockupEntry(category as CompleteMockupFamily, sourceKitSlug, face);
  const normalizedFrame = completeView.geometry.normalizedFrame;

  // The supplied source package has one shared layered PSD/PSB master per
  // family/view; its color control is shared across all exported colorways.
  // The browser renders the validated PNG export. Master files remain source
  // provenance until an authenticated storage ingestion publishes them.
  const curated = getCuratedMockup(product, color, face);
  const masterPath = canonicalMasterPath(category, sourceKitSlug, face);
  const sourceKitKey = `${category}:${sourceKitSlug ?? "white"}:${face}`;
  const runtimeOverride = runtimeMockupOverrides.get(normalizeRuntimeKey(sourceKitKey))
    ?? runtimeMockupOverrides.get(normalizeRuntimeKey(`${category}:${color}:${face}`));
  const runtimePhoto = runtimeOverride?.imageUrl;
  const isPsdTshirtRuntime = category === "tshirt"
    && (face === "front" || face === "back")
    && isPsdDerivedTshirtCustomerReleaseSurface(sourceKitSlug, face);
  const psdPhoto = isPsdTshirtRuntime
    ? `${PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.assetRoot}/${sourceKitSlug}/${face}.png`
    : undefined;
  const sourceMatrix = getApprovedSourceMatrixEntry(category, sourceKitSlug, face);
  const sourceMatrixPhoto = sourceMatrix?.assetPath;
  const waterBottleV11Photo = category === "waterbottle"
    ? WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets[face === "back" ? "back" : "front"].url
    : undefined;
  // A reviewed T-shirt base is selected ahead of remote metadata. Runtime
  // gallery records remain useful for unsupported T-shirt views and other
  // families, but cannot replace an accepted PSD-derived colour/face pair.
  // The accepted 188-surface release is the customer-facing source of truth.
  // Keep the older PSD/source-matrix overrides behind it so an old admin record
  // can never put the green-screen runtime back into the Studio.
  const acceptedReleasePhoto = category === "waterbottle"
    ? undefined
    : (() => {
      const smartV9ColorSlug = getSmartV9ColorSlug(category, sourceKitSlug);
      return smartV9ColorSlug
        ? acceptedSmartV9Release?.assetUrls[`${category}:${smartV9ColorSlug}:${face}`]
        : undefined;
    })();
  const photoSrc = psdPhoto ?? acceptedReleasePhoto ?? waterBottleV11Photo ?? sourceMatrixPhoto ?? runtimePhoto ?? curated.photoSrc;
  const cutoutSrc = psdPhoto ?? acceptedReleasePhoto ?? waterBottleV11Photo ?? sourceMatrixPhoto ?? runtimePhoto ?? curated.cutoutSrc;
  const hasExactColorBase = Boolean(psdPhoto || acceptedReleasePhoto || waterBottleV11Photo || sourceMatrixPhoto || runtimePhoto);

  return {
    colorHex: hex,
    photoSrc,
    cutoutSrc,
    // Admin overrides and the reviewed PSD-derived T-shirt files already hold
    // the final colorway. Treat them as exact color photos through every 2D,
    // 3D, cart, and export consumer; adding any synthetic tint would corrupt
    // the selected physical color.
    isColorPhoto: hasExactColorBase ? true : curated.isColorPhoto,
    cutoutNeedsTint: hasExactColorBase ? false : curated.cutoutNeedsTint,
    photoKind: acceptedReleasePhoto || psdPhoto || sourceMatrixPhoto || runtimePhoto ? "opaque-photo" : curated.photoKind,
    requiresTint: hasExactColorBase ? false : curated.requiresTint,
    allowSilhouetteShadow: false,
    printZone: sourceMatrix?.printZone ?? completeView.geometry.printZone,
    normalizedFrame: sourceMatrix?.normalizedFrame ?? normalizedFrame,
    isOpaquePhoto: acceptedReleasePhoto || psdPhoto || sourceMatrixPhoto || runtimePhoto ? true : curated.photoKind === "opaque-photo",
    editableMasterPath: sourceMatrix?.editableMasterPath ?? runtimeOverride?.masterFileUrl ?? masterPath,
    sourceKitKey,
    smartObject: createSmartMockupManifest({
      category,
      colorSlug: sourceKitSlug ?? "white",
      face,
      sourceKitKey,
      editableMasterPath: sourceMatrix?.editableMasterPath ?? masterPath,
      // The audited source-kit PSD/PSB files are openable raster masters, but
      // contain no genuine Photoshop Smart Object layers yet. Keep the runtime
      // manifest honest and fail closed until a structurally verified master is
      // promoted for this exact surface.
      masterStatus: "manifest-only",
      baseSrc: photoSrc,
      cutoutSrc,
      normalizedFrame: sourceMatrix?.normalizedFrame ?? normalizedFrame,
      printZone: sourceMatrix?.printZone ?? completeView.geometry.printZone,
    }),
    psdMaterialEffects: isPsdTshirtRuntime ? getPsdTshirtMaterialEffects(color, face) : undefined,
    source: acceptedReleasePhoto || sourceMatrixPhoto || runtimePhoto || psdPhoto ? "curated" : "source-kit",
  };
}


// Exported so DesignStudio's live SVG editor can pick the same multiply/screen
// blend mode for uploaded designs that composeGarmentMockup() already uses.
export function isLightTint(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.92;
}

// Returns true ONLY for near-black / very-dark-charcoal colours (luminance < 12%).
// These are the only colours that should use the dedicated black garment photo.
// Every other non-white colour — Navy, Maroon, Olive, Red, Sky Blue, Grey, etc.
// — stays on the white base photo and gets coloured via SVG multiply-tint, so it
// renders in the correct hue instead of looking like a tinted black garment.
// Exported so ProductViewer3D can apply identical photo-selection logic in 3D.
export function isNearBlack(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.12;
}

export function GarmentSVG({
  product,
  color,
  showPrintZone,
  face = "front",
  mugMode,
  baseSrcOverride,
}: {
  product: DesignProduct;
  color?: string;
  showPrintZone: boolean;
  face?: Face;
  mugMode?: "side1" | "side2" | "wrap";
  /** Local review-only source override. Never supplied by the customer resolver. */
  baseSrcOverride?: string;
}) {
  const isMug = product.category === "mug";
  const tintHex = color || product.garmentColor;
  const resolvedFace: CompleteMockupView = isMug && mugMode === "wrap"
    ? "wrap"
    : face;
  const resolvedMockup = resolveMockup(product, tintHex, resolvedFace);
  const needsTint = resolvedMockup.photoKind === "transparent-cutout" && resolvedMockup.requiresTint;
  const displayPZ = resolvedMockup.printZone;

  // The transparent source-kit cutout is the only runtime product layer. The
  // opaque normalized photo remains available as source metadata and for admin
  // inspection, but it must never be stacked beneath or above the cutout in the
  // live editor because that creates the pale duplicate wedges seen in production.
  const canonicalBaseSrc = baseSrcOverride ?? resolvedMockup.cutoutSrc;

  // Canvas background colour: clean white for all products so the mockup reads
  // as a premium product shot on a light, neutral studio surface. Cutout garments
  // get a soft shadow to lift them off the white; full opaque photos cover the
  // canvas entirely so no background colour shows through.
  const canvasBg = "#ffffff";

  // Keep the base preview neutral; realistic lighting is supplied by the product
  // source and the clipped compositor masks, not by an extra glow layer.

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      <defs>
        {/* Smooth cross-fade when switching garment color / face.
            Uses key prop on the image element to retrigger the animation each swap. */}
        <style>{`
          @keyframes garmentFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          .garment-img { animation: garmentFadeIn 0.13s ease-in-out; }
        `}</style>



        {/* No SVG grain, vignette, full-frame shadow, or highlight overlays here.
            The single product source plus the compositor's clipped luminosity
            masks is the PSD-style stack; duplicate SVG treatments create glow. */}

        {/* ── Colour multiply-tint filter ──────────────────────────────────────
            Applied DIRECTLY to the <image> element (not a separate rect).
            SVG guarantees: filter is evaluated first, mask second — no
            isolated-compositing-context issues that break CSS mix-blend-mode.

            IMPORTANT: feBlend multiply sets alpha=1 for transparent pixels
            (because 1-(1-1)*(1-0)=1), filling the background with tintHex.
            The final feComposite operator="in" clips the output back to the
            alpha channel of SourceGraphic so transparent areas stay transparent. */}
        {needsTint && tintHex && (
          <filter id="garment-color-tint" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feFlood floodColor={tintHex} result="flood" />
            <feBlend in="flood" in2="SourceGraphic" mode="multiply" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>
        )}


        {/* Hoodie smart-object detail mask. Artwork sits below these narrow source
            strips so drawstrings remain visible instead of being painted over by
            uploaded images, text, emoji, or AI art. Coordinates are calibrated to
            the 1000×1000 normalized hoodie source-kit frame. */}
        {product.category === "hoodie" && face === "front" && (
          <clipPath id="hoodie-rope-preservation">
            <path d="M462 216 C463 252 455 300 451 350 L450 445" stroke="black" strokeWidth="18" fill="none" strokeLinecap="round" />
            <path d="M555 216 C554 252 560 300 564 350 L565 445" stroke="black" strokeWidth="18" fill="none" strokeLinecap="round" />
          </clipPath>
        )}

        {/* Legacy silhouette guards are retained in the manifest for audit history,
            but runtime product alpha is authoritative in v3. Applying a generic
            path here caused Long Sleeve/Hoodie sleeve cutoffs, so no product image
            is clipped by a coordinate-guessed silhouette. */}
        {product.category === "tshirt" && (
          <clipPath id="tshirt-silhouette" clipPathUnits="userSpaceOnUse">
            <path d="M390 176 Q430 128 500 128 Q570 128 610 176 L760 260 L892 360 L830 485 L738 440 L738 930 Q500 970 262 930 L262 440 L170 485 L108 360 L240 260 Z" />
          </clipPath>
        )}
        {product.category === "longsleeve" && (
          <clipPath id="longsleeve-silhouette" clipPathUnits="userSpaceOnUse">
            <path d="M405 132 Q500 92 595 132 L690 220 L820 300 L920 700 L852 930 L730 890 L700 530 L700 930 Q500 970 300 930 L300 530 L270 890 L148 930 L80 700 L180 300 L310 220 Z" />
          </clipPath>
        )}
        {product.category === "hoodie" && (
          <clipPath id="hoodie-silhouette" clipPathUnits="userSpaceOnUse">
            <path d="M405 42 Q500 18 595 42 Q645 88 650 165 Q690 215 760 250 Q850 285 900 360 Q938 520 948 760 L930 915 Q918 958 860 960 L790 950 L760 680 L735 550 L735 930 Q500 972 265 930 L265 550 L240 680 L210 950 L140 960 Q82 958 70 915 L52 760 Q62 520 100 360 Q150 285 240 250 Q310 215 350 165 Q355 88 405 42 Z" />
          </clipPath>
        )}


      </defs>

      {/* Studio canvas background — clean white for all products so the mockup reads
          as a premium product shot on a light, neutral studio surface. */}
      <rect width={1000} height={1000} fill={canvasBg} style={{ pointerEvents: "none" }} />



      {/* ── Real Smart Mockup Render ───────────────────────────────────────────
          Uses a multi-layer stack for high-fidelity realism:
          1. Base Product Photo (with tint if needed)
          2. Shadow Map (Luminosity Mask)
          3. Highlight Map (Luminosity Mask)
      ───────────────────────────────────────────────────────────────────────── */}

      <g style={{ pointerEvents: "none" }}>
        {/* Layer 1: Base Product */}
        <image
          key={`canonical-cutout-${canonicalBaseSrc}`}
          href={canonicalBaseSrc}
          x={0} y={0} width={1000} height={1000}
          preserveAspectRatio="xMidYMid meet"
          filter={needsTint ? "url(#garment-color-tint)" : undefined}
          className="garment-img"
        />

        {/* No second full-frame source is painted. Protected product details
            remain in the canonical cutout and artwork is clipped separately. */}
      </g>

      {showPrintZone && (() => {
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={printZonePath(displayPZ)}
              stroke="rgba(232,93,4,0.80)" strokeWidth={3.5} fill="rgba(232,93,4,0.05)"
              strokeDasharray={displayPZ.shape && displayPZ.shape !== "rect" ? "10 7" : undefined}
              strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" />
          </g>
        );
      })()}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   FLAT ZONE RENDERER — used for sleeve and neck-label zones.
   Renders the active canonical detail asset inside the print artboard.
   These are explicit flat print-detail templates, not alternate full-product views.
════════════════════════════════════════════════════════ */
export function FlatZoneSVG({
  zone,
  showPrintZone,
  mockup,
}: {
  zone: ApparelZone;
  showPrintZone: boolean;
  /** Canonical resolved mockup for the selected product and colour. */
  mockup: MockupResolution;
}) {
  const { pz, label, pxDimensions } = zone;
  const cx = pz.x + pz.w / 2;

  const isNeck = zone.face === "neck-label";
  const isLeftSleeve = zone.face === "left-sleeve";

  const useTint = mockup.photoKind === "transparent-cutout" && mockup.requiresTint;
  const garmentPhotoSrc = useTint ? mockup.cutoutSrc : mockup.photoSrc;
  // Clean white studio for all zones — matches the garment view so the design
  // tool feels like one coherent surface instead of a dark "blackboard".
  const canvasBg = "#ffffff";
  // Very subtle vignette on white so the artboard still has a sense of depth.
  const vigEndColor = "rgba(0,0,0,0.06)";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      <defs>
        {/* flat-artboard-glow: white glow + drop shadow behind the print-zone artboard */}
        <filter id="flat-artboard-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.06)" />
        </filter>
        <filter id="flat-shadow-sm" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.07)" />
        </filter>
        <clipPath id="flat-clip-pz">
          <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h} rx={10} />
        </clipPath>
        {/* Colour multiply-tint — only defined for mid-range (non-white, non-black) colours.
            Full opacity (floodOpacity="1") matches GarmentSVG exactly.
            feComposite operator="in" clips alpha back to SourceGraphic so
            transparent pixels outside the garment stay transparent (not tintHex). */}
        {useTint && (
          <filter id="flat-color-tint" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feFlood floodColor={mockup.colorHex} floodOpacity="1" result="flood" />
            <feBlend in="flood" in2="SourceGraphic" mode="multiply" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>
        )}
      </defs>

      {/* Canvas background: Clean white studio for all flat zones. */}
      <rect width={1000} height={1000} fill={canvasBg} />

      {/* The active canonical detail asset is the editing surface. Transparent pixels
          reveal the clean artboard; the asset itself carries the product silhouette
          and color-specific material shading. */}
      {garmentPhotoSrc && (
        <image
          href={garmentPhotoSrc}
          x="0" y="0" width="1000" height="1000"
          preserveAspectRatio="xMidYMid meet"
          opacity={0.96}
          style={{ pointerEvents: "none" }}
          filter={useTint ? "url(#flat-color-tint)" : undefined}
        />
      )}

      {/* Subtle vignette — lifts the artboard off the background.
          Strength adjusted by canvas bg: lighter on the warm-light (near-black) bg. */}
      <radialGradient id="flat-vig" cx="50%" cy="50%" r="70%" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1000">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="100%" stopColor={vigEndColor} />
      </radialGradient>
      <rect width={1000} height={1000} fill="url(#flat-vig)" style={{ pointerEvents: "none" }} />

      {/* Zone label pill (above the artboard) */}
      <rect x={cx - 90} y={pz.y - 52} width={180} height={32} rx={16}
        fill="rgba(232,93,4,0.92)" filter="url(#flat-shadow-sm)" />
      <text
        x={cx} y={pz.y - 30}
        textAnchor="middle" fontSize={14} fontWeight={800}
        fill="white"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "0.08em" }}
      >
        {label.toUpperCase()} ZONE
      </text>

      {/* White artboard behind the print zone */}
      <rect
        x={pz.x - 12} y={pz.y - 12} width={pz.w + 24} height={pz.h + 24}
        rx={14} fill="white" filter="url(#flat-artboard-glow)"
      />
      <rect
        x={pz.x} y={pz.y} width={pz.w} height={pz.h}
        rx={10} fill="#FAFAF8"
      />

      {/* Dot grid on artboard */}
      <defs>
        <pattern id="flat-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1.2" fill="rgba(0,0,0,0.07)" />
        </pattern>
      </defs>
      <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h} rx={10} fill="url(#flat-dots)" />

      {/* Zone-specific context icon */}
      {isNeck ? (
        <g transform={`translate(${pz.x + pz.w / 2},${pz.y + 54})`} style={{ pointerEvents: "none" }}>
          <circle r={28} fill="rgba(232,93,4,0.08)" stroke="rgba(232,93,4,0.25)" strokeWidth={1.5} />
          <path d="M -14 0 Q -10 -12 0 -12 Q 10 -12 14 0 Q 8 5 0 5 Q -8 5 -14 0 Z"
            fill="none" stroke="#E85D04" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M -5 -12 Q 0 -18 5 -12"
            fill="none" stroke="#E85D04" strokeWidth="2.5" strokeLinecap="round" />
          <text y={24} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9ca3af"
            style={{ fontFamily: "system-ui" }}>
            inside collar
          </text>
        </g>
      ) : isLeftSleeve ? (
        <g transform={`translate(${pz.x + pz.w / 2},${pz.y + 54})`} style={{ pointerEvents: "none" }}>
          <circle r={28} fill="rgba(232,93,4,0.08)" stroke="rgba(232,93,4,0.25)" strokeWidth={1.5} />
          <rect x={-18} y={-12} width={12} height={24} rx={4} fill="none" stroke="#E85D04" strokeWidth={2.5} />
          <rect x={-6} y={-12} width={24} height={24} rx={3} fill="none" stroke="#9ca3af" strokeWidth={1.5} />
          <text y={44} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9ca3af"
            style={{ fontFamily: "system-ui" }}>
            left sleeve
          </text>
        </g>
      ) : (
        <g transform={`translate(${pz.x + pz.w / 2},${pz.y + 54})`} style={{ pointerEvents: "none" }}>
          <circle r={28} fill="rgba(232,93,4,0.08)" stroke="rgba(232,93,4,0.25)" strokeWidth={1.5} />
          <rect x={6} y={-12} width={12} height={24} rx={4} fill="none" stroke="#E85D04" strokeWidth={2.5} />
          <rect x={-18} y={-12} width={24} height={24} rx={3} fill="none" stroke="#9ca3af" strokeWidth={1.5} />
          <text y={44} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9ca3af"
            style={{ fontFamily: "system-ui" }}>
            right sleeve
          </text>
        </g>
      )}

      {/* Print zone — corner brackets only, no full dashed rect.
          Consistent with GarmentSVG. Pixel dimensions shown below. */}
      {showPrintZone && (() => {
        const x = pz.x, y = pz.y, w = pz.w, h = pz.h;
        const x2 = x + w, y2 = y + h;
        const L = 28;
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={`M${x} ${y+L} L${x} ${y} L${x+L} ${y}`}
              stroke="rgba(232,93,4,0.85)" strokeWidth={3} fill="none"
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={`M${x2-L} ${y} L${x2} ${y} L${x2} ${y+L}`}
              stroke="rgba(232,93,4,0.85)" strokeWidth={3} fill="none"
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={`M${x} ${y2-L} L${x} ${y2} L${x+L} ${y2}`}
              stroke="rgba(232,93,4,0.85)" strokeWidth={3} fill="none"
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={`M${x2-L} ${y2} L${x2} ${y2} L${x2} ${y2-L}`}
              stroke="rgba(232,93,4,0.85)" strokeWidth={3} fill="none"
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {/* Pixel dimensions pill below the artboard */}
            <rect x={cx - 90} y={y2 + 10} width={180} height={22} rx={11}
              fill="rgba(0,0,0,0.55)" />
            <text
              x={cx} y={y2 + 25}
              textAnchor="middle" fontSize={12} fontWeight={600}
              fill="rgba(255,255,255,0.85)"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {pxDimensions}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   STICKERS — curated vector decoration library
════════════════════════════════════════════════════════ */

export interface Sticker {
  id: string;
  name: string;
  svg: string;
  dataUrl: string;
}

const W = (s: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${s}</svg>`;

const RAW_STICKERS: { id: string; name: string; svg: string }[] = [
  { id: "stk-heart",      name: "Heart",       svg: W(`<path d="M50 86 C20 64 8 46 8 30 A20 20 0 0 1 50 22 A20 20 0 0 1 92 30 C92 46 80 64 50 86 Z" fill="#dc2626"/>`) },
  { id: "stk-star",       name: "Star",        svg: W(`<path d="M50 8 L61 38 L93 40 L68 60 L77 92 L50 74 L23 92 L32 60 L7 40 L39 38 Z" fill="#f59e0b"/>`) },
  { id: "stk-bolt",       name: "Lightning",   svg: W(`<path d="M58 6 L18 56 L44 56 L36 94 L80 40 L52 40 L60 6 Z" fill="#facc15" stroke="#a16207" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: "stk-crown",      name: "Crown",       svg: W(`<path d="M14 70 L20 28 L38 50 L50 22 L62 50 L80 28 L86 70 Z" fill="#f59e0b" stroke="#92400e" stroke-width="2" stroke-linejoin="round"/><rect x="14" y="72" width="72" height="10" fill="#92400e"/><circle cx="50" cy="20" r="4" fill="#dc2626"/>`) },
  { id: "stk-circle",     name: "Circle",      svg: W(`<circle cx="50" cy="50" r="40" fill="#111827"/>`) },
  { id: "stk-square",     name: "Square",      svg: W(`<rect x="14" y="14" width="72" height="72" rx="6" fill="#111827"/>`) },
  { id: "stk-triangle",   name: "Triangle",    svg: W(`<path d="M50 12 L90 84 L10 84 Z" fill="#E85D04"/>`) },
  { id: "stk-diamond",    name: "Diamond",     svg: W(`<path d="M50 8 L92 50 L50 92 L8 50 Z" fill="#06b6d4"/>`) },
  { id: "stk-hex",        name: "Hexagon",     svg: W(`<path d="M50 6 L88 28 L88 72 L50 94 L12 72 L12 28 Z" fill="#7c3aed"/>`) },
  { id: "stk-smile",      name: "Smiley",      svg: W(`<circle cx="50" cy="50" r="42" fill="#facc15" stroke="#a16207" stroke-width="3"/><circle cx="36" cy="42" r="5" fill="#1f2937"/><circle cx="64" cy="42" r="5" fill="#1f2937"/><path d="M30 60 Q50 80 70 60" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>`) },
  { id: "stk-sun",        name: "Sun",         svg: W(`<g stroke="#f59e0b" stroke-width="4" stroke-linecap="round"><line x1="50" y1="6" x2="50" y2="18"/><line x1="50" y1="82" x2="50" y2="94"/><line x1="6" y1="50" x2="18" y2="50"/><line x1="82" y1="50" x2="94" y2="50"/><line x1="18" y1="18" x2="26" y2="26"/><line x1="74" y1="74" x2="82" y2="82"/><line x1="82" y1="18" x2="74" y2="26"/><line x1="18" y1="82" x2="26" y2="74"/></g><circle cx="50" cy="50" r="22" fill="#f59e0b"/>`) },
  { id: "stk-moon",       name: "Moon",        svg: W(`<path d="M68 14 A40 40 0 1 0 86 64 A30 30 0 0 1 68 14 Z" fill="#1e3a8a"/>`) },
  { id: "stk-cloud",      name: "Cloud",       svg: W(`<path d="M28 70 A18 18 0 0 1 30 36 A20 20 0 0 1 68 32 A16 16 0 0 1 80 70 Z" fill="#60a5fa" stroke="#1e3a8a" stroke-width="2"/>`) },
  { id: "stk-arrow",      name: "Arrow",       svg: W(`<path d="M10 40 H60 V24 L92 50 L60 76 V60 H10 Z" fill="#111827"/>`) },
  { id: "stk-check",      name: "Check",       svg: W(`<path d="M14 52 L40 78 L88 22" fill="none" stroke="#16a34a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { id: "stk-cross",      name: "Cross",       svg: W(`<path d="M20 20 L80 80 M80 20 L20 80" stroke="#dc2626" stroke-width="14" stroke-linecap="round"/>`) },
  { id: "stk-flower",     name: "Flower",      svg: W(`<g fill="#ec4899"><circle cx="50" cy="22" r="14"/><circle cx="78" cy="50" r="14"/><circle cx="50" cy="78" r="14"/><circle cx="22" cy="50" r="14"/></g><circle cx="50" cy="50" r="12" fill="#fde047"/>`) },
  { id: "stk-coffee",     name: "Coffee",      svg: W(`<path d="M22 30 H72 V62 A18 18 0 0 1 54 80 H40 A18 18 0 0 1 22 62 Z" fill="#92400e"/><path d="M72 38 H82 A10 10 0 0 1 82 58 H72" fill="none" stroke="#92400e" stroke-width="6"/><path d="M34 18 Q40 10 34 4 M50 18 Q56 10 50 4 M66 18 Q72 10 66 4" stroke="#9ca3af" stroke-width="3" fill="none" stroke-linecap="round"/>`) },
  { id: "stk-ribbon",     name: "Ribbon",      svg: W(`<path d="M8 38 H92 L78 50 L92 62 H8 L22 50 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: "stk-music",      name: "Music Note",  svg: W(`<path d="M44 14 V64 A12 12 0 1 1 36 52 V26 L72 18 V58 A12 12 0 1 1 64 46 V14 Z" fill="#111827"/>`) },
];

export function stickerToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STICKERS: Sticker[] = RAW_STICKERS.map(s => ({
  ...s,
  dataUrl: stickerToDataUrl(s.svg),
}));
