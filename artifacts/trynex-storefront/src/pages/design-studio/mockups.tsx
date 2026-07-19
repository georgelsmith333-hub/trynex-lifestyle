/* ═══════════════════════════════════════════════════════
   GARMENT MOCKUPS — photographic templates
   All products use a unified 1000×1000 coordinate space.
   The mockup PNGs live in /public/mockups/<id>-<face>.png
════════════════════════════════════════════════════════ */

const tshirtFront          = "/mockups/white-tshirt-front.png";
const tshirtBack           = "/mockups/white-tshirt-back.png";
const tshirtFrontDark      = "/mockups/black-tshirt-front.png";
const tshirtBackDark       = "/mockups/black-tshirt-back.png";
const tshirtFrontCutout    = "/mockups/white-tshirt-front-cutout.png";
const tshirtBackCutout     = "/mockups/white-tshirt-back-cutout.png";
const longsleeveFront          = "/mockups/white-longsleeve-front.png";
const longsleeveBack           = "/mockups/white-longsleeve-back.png";
const longsleeveFrontDark      = "/mockups/black-longsleeve-front.png";
const longsleeveBackDark       = "/mockups/black-longsleeve-back.png";
const longsleeveFrontCutout    = "/mockups/white-longsleeve-front-cutout-real.png";
const longsleeveBackCutout     = "/mockups/white-longsleeve-back-cutout-real.png";
const longsleeveFrontDarkCutout = "/mockups/black-longsleeve-front-cutout.png";
const longsleeveBackDarkCutout  = "/mockups/black-longsleeve-back-cutout.png";
const hoodieFront          = "/mockups/white-hoodie-front.png";
const hoodieBack           = "/mockups/white-hoodie-back.png";
const hoodieFrontDark      = "/mockups/black-hoodie-front.png";
const hoodieBackDark       = "/mockups/black-hoodie-back.png";
const hoodieFrontCutout    = "/mockups/white-hoodie-front-cutout-real.png";
const hoodieBackCutout     = "/mockups/white-hoodie-back-cutout-real.png";
const mugFront             = "/mockups/white-mug-front.png";
const mugFrontDark         = "/mockups/black-mug-front.png";
const mugFrontCutout       = "/mockups/white-mug-front-cutout.png";
const mugFrontDarkCutout   = "/mockups/black-mug-front-cutout.png";
const capFront             = "/mockups/white-cap-front.png";
// black-cap-front.png has no alpha and is 896×1280 (wrong size) — cap uses SVG tint for all dark colours
const capFrontCutout       = "/mockups/white-cap-front-cutout.png";
const waterBottleFront          = "/mockups/white-waterbottle-front.png";
const waterBottleCutout         = "/mockups/white-waterbottle-front-cutout.png";
const tshirtFrontDarkCutout     = "/mockups/black-tshirt-front-cutout.png";
const tshirtBackDarkCutout      = "/mockups/black-tshirt-back-cutout.png";
const hoodieFrontDarkCutout     = "/mockups/black-hoodie-front-cutout-real.png";
const hoodieBackDarkCutout      = "/mockups/black-hoodie-back-cutout-real.png";

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

export interface PrintZone { x: number; y: number; w: number; h: number }

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
     CAP_PZ                    — cap front panel
   Flat-template zones (no garment image):
     SLEEVE_PZ      — left-sleeve and right-sleeve
     NECK_LABEL_PZ  — neck-label
   Drinkware zones:
     MUG_SIDE_PZ    — single-side editing (side view)
     MUG_PZ         — full 360° wrap
     WATERBOTTLE_PZ — bottle body (cylindrical section)
──────────────────────────────────────────────────────── */
export const TSHIRT_PZ: PrintZone           = { x: 240, y: 185, w: 520, h: 580 };
export const TSHIRT_BACK_PZ: PrintZone      = { x: 240, y: 185, w: 520, h: 580 };
export const LONGSLEEVE_PZ: PrintZone       = { x: 310, y: 228, w: 380, h: 400 };
export const LONGSLEEVE_BACK_PZ: PrintZone  = { x: 292, y: 195, w: 416, h: 458 };
/** Hoodie front — stops at ~y=528 to clear the kangaroo pocket (pocket starts ~y=565). */
export const HOODIE_PZ: PrintZone           = { x: 240, y: 195, w: 520, h: 510 };
export const HOODIE_BACK_PZ: PrintZone      = { x: 292, y: 184, w: 416, h: 448 };
/** Cap front panel — structured 5-panel cap, panel is centred between brim and seam. */
export const CAP_PZ: PrintZone              = { x: 300, y: 230, w: 400, h: 240 };
export const MUG_PZ: PrintZone              = { x: 120, y: 210, w: 760, h: 420 };
/** Mug side — printable area on the cylindrical side face, clear of rim band and base ring. */
export const MUG_SIDE_PZ: PrintZone         = { x: 192, y: 248, w: 410, h: 472 };
/** Water bottle — printable front label panel on the cylindrical body.
 *  Calibrated to the real 600ml aluminium carabiner bottle (1600×1600 PNG).
 *  Content spans x:[336–660] centre≈498; shoulder ends ~y=268, base band ~y=850. */
export const WATERBOTTLE_PZ: PrintZone      = { x: 330, y: 180, w: 340, h: 560 };
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
): ApparelZone[] {
  const frontPZ = productPZ ?? TSHIRT_PZ;
  const backPZ  = productBackPZ ?? frontPZ;
  switch (category) {
    case "tshirt":
    case "longsleeve":
    case "hoodie":
      return [
        { face: "front",       label: "Front",        shortLabel: "Front",  pxDimensions: FRONT_BACK_DIMS, pz: frontPZ,   isFlat: false },
        { face: "back",        label: "Back",         shortLabel: "Back",   pxDimensions: FRONT_BACK_DIMS, pz: backPZ,    isFlat: false },
        { face: "left-sleeve", label: "Left Sleeve",  shortLabel: "L.Sleeve", pxDimensions: SLEEVE_DIMS,  pz: SLEEVE_PZ, isFlat: true  },
        { face: "right-sleeve",label: "Right Sleeve", shortLabel: "R.Sleeve", pxDimensions: SLEEVE_DIMS,  pz: SLEEVE_PZ, isFlat: true  },
        { face: "neck-label",  label: "Neck Label",   shortLabel: "Neck",   pxDimensions: NECK_DIMS,      pz: NECK_LABEL_PZ, isFlat: true },
      ];
    default:
      return [
        { face: "front", label: "Front", shortLabel: "Front", pxDimensions: FRONT_BACK_DIMS, pz: frontPZ, isFlat: false },
      ];
  }
}

/** Get the print zone for a given face and product (used by DesignStudio). */
export function getZonePZ(face: Face, product: DesignProduct): PrintZone {
  if (product.category === "mug") return MUG_SIDE_PZ;
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
    frontSrc: tshirtFront, backSrc: tshirtBack,
  },
  {
    id: "longsleeve", name: "Unisex Long Sleeve", icon: "👔", category: "longsleeve",
    garmentColor: "#F5F5F3",
    colors: [
      { name: "White",    hex: "#F5F5F3" }, { name: "Black",    hex: "#1a1a1a" },
      { name: "Navy",     hex: "#1e3a5f" }, { name: "Maroon",   hex: "#7f1d1d" },
      { name: "Olive",    hex: "#4a5240" }, { name: "Grey",     hex: "#6b7280" },
      { name: "Red",      hex: "#dc2626" }, { name: "Sky Blue", hex: "#0ea5e9" },
      { name: "Burgundy", hex: "#6b1a2c" }, { name: "Forest",   hex: "#166534" },
    ],
    description: "240GSM Cotton",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: LONGSLEEVE_PZ, printZoneBack: LONGSLEEVE_BACK_PZ,
    frontSrc: longsleeveFront, backSrc: longsleeveBack,
  },
  {
    id: "hoodie", name: "Unisex Hoodie", icon: "🧥", category: "hoodie",
    garmentColor: "#F2EFE9",
    colors: [
      { name: "White",    hex: "#F2EFE9" }, { name: "Black",    hex: "#1a1a1a" },
      { name: "Navy",     hex: "#1e3a5f" }, { name: "Grey",     hex: "#6b7280" },
      { name: "Maroon",   hex: "#7f1d1d" }, { name: "Olive",    hex: "#4a5240" },
      { name: "Red",      hex: "#dc2626" }, { name: "Sky Blue", hex: "#0ea5e9" },
      { name: "Forest",   hex: "#166534" }, { name: "Burgundy", hex: "#6b1a2c" },
    ],
    description: "320GSM Fleece", badge: "New",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: HOODIE_PZ, printZoneBack: HOODIE_BACK_PZ,
    frontSrc: hoodieFront, backSrc: hoodieBack,
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
    frontSrc: mugFront,
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
    printZone: CAP_PZ,
    frontSrc: capFront,
  },
  {
    id: "waterbottle", name: "Water Bottle", icon: "🥤", category: "waterbottle",
    garmentColor: "#F4F3F1",
    colors: [
      { name: "White",    hex: "#F4F3F1" }, { name: "Black",    hex: "#1C1917" },
      { name: "Navy",     hex: "#1e3a5f" }, { name: "Forest",   hex: "#166534" },
      { name: "Sky Blue", hex: "#0ea5e9" }, { name: "Red",      hex: "#dc2626" },
      { name: "Pink",     hex: "#f472b6" }, { name: "Teal",     hex: "#0f766e" },
    ],
    description: "600ml Aluminium",
    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: WATERBOTTLE_PZ,
    frontSrc: WATERBOTTLE_MOCKUP_URL,
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
  { front: string; back?: string; darkFront?: string; darkBack?: string; frontCutout?: string; backCutout?: string; darkFrontCutout?: string; darkBackCutout?: string } | undefined
> = {
  tshirt:      { front: tshirtFront, back: tshirtBack, darkFront: tshirtFrontDark, darkBack: tshirtBackDark, frontCutout: tshirtFrontCutout, backCutout: tshirtBackCutout, darkFrontCutout: tshirtFrontDarkCutout, darkBackCutout: tshirtBackDarkCutout },
  longsleeve:  { front: longsleeveFront, back: longsleeveBack, frontCutout: longsleeveFrontCutout, backCutout: longsleeveBackCutout, darkFrontCutout: longsleeveFrontDarkCutout, darkBackCutout: longsleeveBackDarkCutout },
  hoodie:      { front: hoodieFront, back: hoodieBack, darkFront: hoodieFrontDark, darkBack: hoodieBackDark, frontCutout: hoodieFrontCutout, backCutout: hoodieBackCutout, darkFrontCutout: hoodieFrontDarkCutout, darkBackCutout: hoodieBackDarkCutout },
  mug:         { front: mugFront, back: mugFront, darkFront: mugFrontDark, darkBack: mugFrontDark, frontCutout: mugFrontCutout, darkFrontCutout: mugFrontDarkCutout, darkBackCutout: mugFrontDarkCutout },
  cap:         { front: capFront, frontCutout: capFrontCutout },
  waterbottle: { front: waterBottleFront, frontCutout: waterBottleCutout },
  // watertumbler uses category "waterbottle" — shares the same base entry
};


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
}: {
  product: DesignProduct;
  color?: string;
  showPrintZone: boolean;
  face?: Face;
  mugMode?: "side1" | "side2" | "wrap";
}) {
  const isMug = product.category === "mug";
  const base = BASE_BY_CATEGORY[product.category];
  const tintHex = color || product.garmentColor;
  // Only treat a colour as "use the dedicated dark photo" when that photo actually
  // exists for this product (mug, tshirt, hoodie). Products without a dark photo
  // (cap, longsleeve, waterbottle) must fall through to the tint path below, or a
  // near-black selection would render as an untinted white cutout (looks white/blank).
  const hasDarkPhotoAsset = !!(base?.darkFrontCutout || base?.darkFront);
  const useBlackPhoto = !!tintHex && isNearBlack(tintHex) && hasDarkPhotoAsset;
  const needsTint = !!tintHex && !isLightTint(tintHex) && !useBlackPhoto;

  const imageSrc = (() => {
    if (!base) return (face === "back" && product.backSrc) ? product.backSrc : product.frontSrc;
    // ── Dark / near-black garment ─────────────────────────────────────────
    // Prefer the FULL dark photo (RGB, no alpha, has its own studio background)
    // over the dark cutout. A dark-silhouette cutout on the dark studio canvas
    // (#1C1C1E) is essentially invisible. The full photo always produces contrast.
    // Fallback chain: full-back → cutout-back → full-front → cutout-front → white base.
    if (useBlackPhoto) {
      if (face === "back" && base.darkBack) return base.darkBack;
      if (face === "back" && base.darkBackCutout) return base.darkBackCutout;
      if (base.darkFront) return base.darkFront;
      if (base.darkFrontCutout) return base.darkFrontCutout;
      // No dark photo asset — fall through to tint path below.
    }
    // ── White / light garment ─────────────────────────────────────────────
    // Use transparent cutout so the garment floats on the dark canvas.
    // Fallback: backCutout → back photo (correct face first!) → frontCutout → front.
    if (!needsTint && !useBlackPhoto) {
      if (face === "back" && base.backCutout) return base.backCutout;
      if (face === "back" && base.back) return base.back;
      if (base.frontCutout) return base.frontCutout;
      return base.front;
    }
    // ── Coloured garment (tint path) ───────────────────────────────────────
    // Also reached by dark garments that have no dedicated dark photo (e.g. longsleeve).
    // Uses the white cutout + SVG multiply-tint filter — colour is applied in GarmentSVG render.
    if (face === "back" && base.backCutout) return base.backCutout;
    if (base.frontCutout) return base.frontCutout;
    if (face === "back" && base.back) return base.back;
    return base.front;
  })();

  const pz = (() => {
    if (!isMug) return (face === "back" && product.printZoneBack) ? product.printZoneBack : product.printZone;
    if (mugMode === "wrap") return MUG_PZ;
    return MUG_SIDE_PZ;
  })();

  const isMugRightSide = isMug && (face === "back" || mugMode === "side2");
  const displayPZ = isMugRightSide ? { ...pz, x: 1000 - pz.x - pz.w } : pz;

  // Source used for the coloured tint path. We always use the transparent cutout PNG
  // itself, not the full studio photo + a separate mask. The cutout already carries
  // the garment silhouette in its alpha channel, so using it directly prevents the
  // ghost/double-image effect that happens when the full photo and cutout are not
  // perfectly aligned (longsleeve, cap, mug, waterbottle).
  const tintPhotoSrc = base
    ? (face === "back" && base.backCutout ? base.backCutout : (base.frontCutout ?? ""))
    : (face === "back" && product.backSrc ? product.backSrc : product.frontSrc);

  // Keep the separate cutout mask source only when we need the shadow pass for the
  // coloured tint path. For light/white garments the cutout is rendered directly.
  const cutoutMaskSrc = base
    ? (face === "back" && base.backCutout ? base.backCutout : (base.frontCutout ?? ""))
    : "";

  // True when the selected dark imageSrc is a full studio photo (has its own baked
  // background — no transparent pixels we need to worry about). Detection relies on
  // the naming convention: files containing "cutout" in their path are transparent
  // PNGs; all other dark-garment files are full opaque studio photos.
  const isFullDarkPhoto = useBlackPhoto && !imageSrc.includes("cutout");

  // Canvas background colour:
  //   • Dark/black garments that ARE rendered via the tint path (no full photo):
  //     use a clean light tone so the dark-tinted silhouette is visible.
  //   • Everything else (white, coloured, OR dark-with-full-photo): studio charcoal.
  //     When a full dark photo is used it covers the bg rect anyway, so this only
  //     matters for the tint-path dark case (e.g. longsleeve black).
  const needsDarkGarmentLightBg = isNearBlack(tintHex) && !isFullDarkPhoto;
  const canvasBg = needsDarkGarmentLightBg ? "#f5f5f7" : "#2a2a2e";

  // Drop-shadow filter: only on transparent-bg (cutout) images.
  // Applying it to a full opaque photo creates a box shadow around the rectangle.
  const shadowFilter = isFullDarkPhoto ? undefined : "url(#garment-shadow)";

  return (
    <>
      <defs>
        {/* Drop shadow — crisp silhouette lift on the dark studio canvas.
            Applied only to cutout (transparent) images, not full opaque photos. */}
        <filter id="garment-shadow" x="-10%" y="-8%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="8" stdDeviation="22" floodColor="rgba(0,0,0,0.65)" />
          <feDropShadow dx="0" dy="2" stdDeviation="6"  floodColor="rgba(0,0,0,0.30)" />
        </filter>

        {/* ── Colour multiply-tint filter ──────────────────────────────────────
            Applied DIRECTLY to the <image> element (not a separate rect).
            SVG guarantees: filter is evaluated first, mask second — no
            isolated-compositing-context issues that break CSS mix-blend-mode. */}
        {needsTint && tintHex && (
          <filter id="garment-color-tint" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feFlood floodColor={tintHex} result="flood" />
            <feBlend in="flood" in2="SourceGraphic" mode="multiply" />
          </filter>
        )}

        {/* ── Shadow-only filter for tinted garments ───────────────────────────
            SVG elements can only hold ONE filter. For the tint path, that slot is
            taken by garment-color-tint. So we use a SEPARATE filter that outputs
            ONLY the drop-shadow (no source image) from the garment alpha-channel.
            Rendered before the tinted garment, it sits behind the garment layer. */}
        {needsTint && cutoutMaskSrc && (
          <filter id="garment-tint-shadow" x="-12%" y="-10%" width="124%" height="124%" colorInterpolationFilters="sRGB">
            {/* Layer 1: soft outer shadow */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="22" result="blur1" />
            <feOffset       in="blur1" dx="0" dy="8"  result="off1" />
            <feFlood        floodColor="rgba(0,0,0,0.65)" floodOpacity="1" result="col1" />
            <feComposite    in="col1"  in2="off1"    operator="in" result="shadow1" />
            {/* Layer 2: tight inner shadow */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="6"  result="blur2" />
            <feOffset       in="blur2" dx="0" dy="2"  result="off2" />
            <feFlood        floodColor="rgba(0,0,0,0.30)" floodOpacity="1" result="col2" />
            <feComposite    in="col2"  in2="off2"    operator="in" result="shadow2" />
            {/* Merge both shadow layers — output has NO source image */}
            <feMerge>
              <feMergeNode in="shadow1" />
              <feMergeNode in="shadow2" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Studio canvas background — dark for white/coloured garments (they pop with contrast),
          warm-light for near-black garments rendered via tint path (silhouette visibility).
          Full opaque dark photos cover this rect entirely, so the colour is irrelevant there. */}
      <rect width={1000} height={1000} fill={canvasBg} style={{ pointerEvents: "none" }} />

      {/* ── Garment render ────────────────────────────────────────────────────
          COLOURED  → shadow-only pass (behind), then multiply-tinted photo (in front).
                      Both use the cutout PNG: shadow-only filter emits only the
                      shadow from the alpha channel; the tint filter blends hue onto
                      the white studio photo, clipped to garment silhouette mask.
          WHITE     → full product photo with drop shadow (no tint needed).
          NEAR-BLACK → dedicated dark photo with drop shadow.
      ───────────────────────────────────────────────────────────────────────── */}

      {/* Shadow pass for coloured garments — rendered first so it sits BEHIND the garment */}
      {needsTint && cutoutMaskSrc && (
        <image
          href={cutoutMaskSrc}
          x={0} y={0} width={1000} height={1000}
          preserveAspectRatio="xMidYMid meet"
          filter="url(#garment-tint-shadow)"
          style={{ pointerEvents: "none" }}
        />
      )}

      {needsTint && tintPhotoSrc ? (
        isMugRightSide ? (
          <g transform="translate(1000,0) scale(-1,1)">
            <image
              href={tintPhotoSrc}
              x={0} y={0} width={1000} height={1000}
              preserveAspectRatio="xMidYMid meet"
              filter="url(#garment-color-tint)"
              style={{ pointerEvents: "none" }}
            />
          </g>
        ) : (
          <image
            href={tintPhotoSrc}
            x={0} y={0} width={1000} height={1000}
            preserveAspectRatio="xMidYMid meet"
            filter="url(#garment-color-tint)"
            style={{ pointerEvents: "none" }}
          />
        )
      ) : (
        isMugRightSide ? (
          <g transform="translate(1000,0) scale(-1,1)" filter={shadowFilter}>
            <image
              href={imageSrc}
              x={0} y={0} width={1000} height={1000}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: "none" }}
            />
          </g>
        ) : (
          <g filter={shadowFilter}>
            <image
              href={imageSrc}
              x={0} y={0} width={1000} height={1000}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: "none" }}
            />
          </g>
        )
      )}

      {showPrintZone && (() => {
        const { x, y, w, h } = displayPZ;
        const x2 = x + w, y2 = y + h;
        const L = 32;
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={`M${x} ${y+L} L${x} ${y} L${x+L} ${y}`}
              stroke="rgba(232,93,4,0.80)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" />
            <path d={`M${x2-L} ${y} L${x2} ${y} L${x2} ${y+L}`}
              stroke="rgba(232,93,4,0.80)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" />
            <path d={`M${x} ${y2-L} L${x} ${y2} L${x+L} ${y2}`}
              stroke="rgba(232,93,4,0.80)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" />
            <path d={`M${x2-L} ${y2} L${x2} ${y2} L${x2} ${y2-L}`}
              stroke="rgba(232,93,4,0.80)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" />
          </g>
        );
      })()}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   FLAT ZONE RENDERER — used for sleeve and neck-label zones.
   Shows the real garment photo as a dimmed background for context,
   with an artboard overlay highlighting the printable area.
   No more pure-SVG artboard — real product photography is always shown.
════════════════════════════════════════════════════════ */
export function FlatZoneSVG({
  zone,
  showPrintZone,
  garmentPhotoSrc,
  garmentColor,
}: {
  zone: ApparelZone;
  showPrintZone: boolean;
  /** Real product photo URL (frontSrc from the selected product) shown as context. */
  garmentPhotoSrc?: string;
  /** Selected garment hex colour — tints the background photo to match. */
  garmentColor?: string;
}) {
  const { pz, label, pxDimensions } = zone;
  const cx = pz.x + pz.w / 2;

  const isNeck = zone.face === "neck-label";
  const isLeftSleeve = zone.face === "left-sleeve";

  // ── Colour classification (mirrors GarmentSVG logic) ────────────────────
  // • Light tint  (lum > 0.92): white/off-white garment → show photo as-is, dark canvas
  // • Near-black  (lum < 0.12): dark/black garment → show dark photo as-is, LIGHT canvas
  //                              so the silhouette is visible (matches canvasBg in GarmentSVG)
  // • Mid-range              : multiply-tint the white cutout, dark canvas
  const isNearBlackGarment = garmentColor ? isNearBlack(garmentColor) : false;
  const useTint = garmentColor && !isLightTint(garmentColor) && !isNearBlackGarment;
  // Clean studio for white/coloured; off-white so near-black silhouette stays visible.
  const canvasBg = isNearBlackGarment ? "#f5f5f7" : "#2a2a2e";
  // Vignette darkens the canvas edges — invert to a light vignette on the off-white bg.
  const vigEndColor = isNearBlackGarment ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.22)";

  return (
    <>
      <defs>
        {/* flat-artboard-glow: white glow + drop shadow behind the print-zone artboard */}
        <filter id="flat-artboard-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="18" floodColor="rgba(255,255,255,0.60)" />
          <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="rgba(0,0,0,0.18)" />
        </filter>
        <filter id="flat-shadow-sm">
          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="rgba(0,0,0,0.12)" />
        </filter>
        <clipPath id="flat-clip-pz">
          <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h} rx={10} />
        </clipPath>
        {/* Colour multiply-tint — only defined for mid-range (non-white, non-black) colours.
            Full opacity (floodOpacity="1") matches GarmentSVG exactly. */}
        {useTint && (
          <filter id="flat-color-tint" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feFlood floodColor={garmentColor!} floodOpacity="1" result="flood" />
            <feBlend in="flood" in2="SourceGraphic" mode="multiply" />
          </filter>
        )}
      </defs>

      {/* Canvas background:
          • dark studio (#1C1C1E) for white and mid-range garments (they pop with contrast)
          • warm light (#EAE8E4) for near-black garments (dark silhouette needs light bg) */}
      <rect width={1000} height={1000} fill={canvasBg} />
      {garmentPhotoSrc ? (
        useTint ? (
          /* Mid-range colour (navy, red, sky-blue, etc.) — full multiply-tint.
             Matches GarmentSVG so sleeve zone colour is identical to the main view. */
          <image
            href={garmentPhotoSrc}
            x={0} y={0} width={1000} height={1000}
            preserveAspectRatio="xMidYMid meet"
            filter="url(#flat-color-tint)"
            style={{ pointerEvents: "none" }}
          />
        ) : (
          /* White/light OR near-black garment — show the photo as-is at high opacity.
             For white: transparent cutout floats on dark studio canvas.
             For near-black: dark cutout photo (passed by DesignStudio) floats on warm
             light canvas — silhouette clearly visible, no tint multiplication. */
          <image
            href={garmentPhotoSrc}
            x={0} y={0} width={1000} height={1000}
            preserveAspectRatio="xMidYMid meet"
            opacity="0.92"
            style={{ pointerEvents: "none" }}
          />
        )
      ) : (
        <rect width={1000} height={1000} fill="#d4d0ca" />
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
    </>
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
