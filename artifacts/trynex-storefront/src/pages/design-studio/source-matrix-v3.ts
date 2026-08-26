import type { PrintZone } from "./mockups";
import type { CompleteMockupView } from "./complete-mockup-matrix";

export type SourceMatrixV3Family = "longsleeve" | "hoodie";
export type SourceMatrixV3Colour = "white" | "black" | "charcoal" | "heather-grey" | "navy" | "royal-blue" | "forest-green" | "burgundy" | "red" | "sand";

export interface SourceMatrixV3Entry {
  family: SourceMatrixV3Family;
  colour: SourceMatrixV3Colour;
  face: CompleteMockupView;
  assetPath: string;
  /** Provenance reference only; PSD masters remain quarantined and are never web assets. */
  editableMasterPath: string;
  normalizedFrame: { canvasWidth: 1000; canvasHeight: 1000; x: number; y: number; w: number; h: number };
  printZone: PrintZone;
}

const VIEWS = ["front", "back", "left-sleeve", "right-sleeve", "neck-label"] as const;
const COLOURS = ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"] as const;

const frames: Record<SourceMatrixV3Family, Record<(typeof VIEWS)[number], SourceMatrixV3Entry["normalizedFrame"]>> = {
  longsleeve: {
    front: { canvasWidth: 1000, canvasHeight: 1000, x: 0, y: 62.5, w: 1000, h: 875 },
    back: { canvasWidth: 1000, canvasHeight: 1000, x: 0, y: 62.5, w: 1000, h: 875 },
    "left-sleeve": { canvasWidth: 1000, canvasHeight: 1000, x: 227.2727, y: 0, w: 545.4545, h: 1000 },
    "right-sleeve": { canvasWidth: 1000, canvasHeight: 1000, x: 227.2727, y: 0, w: 545.4545, h: 1000 },
    "neck-label": { canvasWidth: 1000, canvasHeight: 1000, x: 41.6667, y: 0, w: 916.6667, h: 1000 },
  },
  hoodie: {
    front: { canvasWidth: 1000, canvasHeight: 1000, x: 0, y: 62.5, w: 1000, h: 875 },
    back: { canvasWidth: 1000, canvasHeight: 1000, x: 0, y: 62.5, w: 1000, h: 875 },
    "left-sleeve": { canvasWidth: 1000, canvasHeight: 1000, x: 196.9697, y: 0, w: 606.0606, h: 1000 },
    "right-sleeve": { canvasWidth: 1000, canvasHeight: 1000, x: 196.9697, y: 0, w: 606.0606, h: 1000 },
    "neck-label": { canvasWidth: 1000, canvasHeight: 1000, x: 112.069, y: 0, w: 775.8621, h: 1000 },
  },
};

/** Exact source Smart Object boxes normalized to the Studio’s 1000×1000 composition canvas. */
const printZones: Record<SourceMatrixV3Family, Record<(typeof VIEWS)[number], PrintZone>> = {
  longsleeve: {
    front: { x: 336.5, y: 327.25, w: 308.75, h: 266.5 },
    back: { x: 328.5, y: 366.25, w: 328.75, h: 86.25 },
    "left-sleeve": { x: 378.7879, y: 290.9091, w: 175.7576, h: 484.8485 },
    "right-sleeve": { x: 378.7879, y: 290.9091, w: 175.7576, h: 484.8485 },
    "neck-label": { x: 333.3333, y: 275, w: 333.3333, h: 258.3333 },
  },
  hoodie: {
    front: { x: 171.75, y: 121.25, w: 677, h: 737 },
    back: { x: 172, y: 123.75, w: 679.5, h: 733.25 },
    "left-sleeve": { x: 378.7879, y: 242.4242, w: 212.1212, h: 424.2424 },
    "right-sleeve": { x: 378.7879, y: 242.4242, w: 212.1212, h: 424.2424 },
    "neck-label": { x: 327.5862, y: 258.6207, w: 344.8276, h: 387.931 },
  },
};

export function isSourceMatrixV3Family(value: string): value is SourceMatrixV3Family {
  return value === "longsleeve" || value === "hoodie";
}

export function getSourceMatrixV3Entry(family: SourceMatrixV3Family, colour: string, face: CompleteMockupView): SourceMatrixV3Entry | undefined {
  if (!VIEWS.includes(face as (typeof VIEWS)[number]) || !COLOURS.includes(colour as SourceMatrixV3Colour)) return undefined;
  const sourceColour = colour as SourceMatrixV3Colour;
  return {
    family,
    colour: sourceColour,
    face,
    assetPath: `/mockups/source-matrix-v3/${family}/${sourceColour}/${face}.jpg`,
    editableMasterPath: `quarantine/source-matrix-v3/${family}/${sourceColour}/${face}.psd`,
    normalizedFrame: frames[family][face as (typeof VIEWS)[number]],
    printZone: printZones[family][face as (typeof VIEWS)[number]],
  };
}

export function validateSourceMatrixV3(): string[] {
  const errors: string[] = [];
  for (const family of ["longsleeve", "hoodie"] as const) for (const colour of COLOURS) for (const face of VIEWS) {
    const entry = getSourceMatrixV3Entry(family, colour, face);
    if (!entry || !entry.assetPath.startsWith("/mockups/source-matrix-v3/")) errors.push(`missing or unsafe v3 entry: ${family}:${colour}:${face}`);
  }
  return errors;
}
