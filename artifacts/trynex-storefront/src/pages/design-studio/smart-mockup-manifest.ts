export type SmartMockupCategory = "mug" | "cap" | "waterbottle" | "tshirt" | "longsleeve" | "hoodie";
export type SmartMockupFace = "front" | "back" | "left-sleeve" | "right-sleeve" | "neck-label" | "wrap";

export interface SmartObjectPrintZone {
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: string;
}

export interface SmartMockupManifest {
  schema: "trynex-smart-mockup/v3";
  masterFormat: "psd" | "psb";
  masterStatus: "verified" | "manifest-only";
  category: SmartMockupCategory;
  colorSlug: string;
  face: SmartMockupFace;
  sourceKitKey: string;
  editableMasterPath: string;
  assets: {
    baseSrc: string;
    cutoutSrc: string;
    detailMaskSrc?: string;
  };
  normalizedFrame: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number };
  printZone: SmartObjectPrintZone;
  protectedDetails: string[];
  warp: {
    mode: "flat" | "cylinder" | "perspective" | "cap-panel";
    curvature: number;
    seamPadding: number;
    preserveAspect: boolean;
  };
  masks: {
    shadow: "source-luminance-multiply";
    highlight: "source-luminance-screen";
    clipToPrintZone: true;
    preserveProtectedDetails: true;
    duplicateBasePass: false;
  };
  shading: {
    multiplyOpacity: number;
    screenOpacity: number;
    grainOpacity: number;
  };
}

const CATEGORY_DEFAULTS: Record<SmartMockupCategory, SmartMockupManifest["warp"]> = {
  mug: { mode: "cylinder", curvature: 0.16, seamPadding: 0.035, preserveAspect: true },
  cap: { mode: "cap-panel", curvature: 0.10, seamPadding: 0.025, preserveAspect: true },
  waterbottle: { mode: "cylinder", curvature: 0.16, seamPadding: 0.04, preserveAspect: true },
  tshirt: { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
  longsleeve: { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
  hoodie: { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
};

const PROTECTED_DETAILS: Record<SmartMockupCategory, string[]> = {
  mug: ["rim", "handle", "base"],
  cap: ["brim", "crown-seams", "rear-opening", "strap"],
  waterbottle: ["lid", "key-ring-loop", "side-carabiner", "shoulder", "rounded-base"],
  tshirt: ["collar", "sleeve-edges", "seams", "hem"],
  longsleeve: ["collar", "cuffs", "sleeve-edges", "seams", "hem"],
  hoodie: ["hood", "drawstrings", "pocket", "cuffs", "seams", "hem"],
};

export function createSmartMockupManifest(args: {
  category: SmartMockupCategory;
  colorSlug?: string;
  face?: SmartMockupFace;
  sourceKitKey: string;
  editableMasterPath: string;
  masterStatus?: SmartMockupManifest["masterStatus"];
  baseSrc?: string;
  cutoutSrc?: string;
  detailMaskSrc?: string;
  normalizedFrame: SmartMockupManifest["normalizedFrame"];
  printZone: SmartObjectPrintZone;
}): SmartMockupManifest {
  const face = args.face ?? "front";
  const colorSlug = args.colorSlug ?? "white";
  const baseSrc = args.baseSrc ?? "";
  const cutoutSrc = args.cutoutSrc ?? baseSrc;
  return {
    schema: "trynex-smart-mockup/v3",
    masterFormat: args.category === "waterbottle" || args.category === "mug" ? "psb" : "psd",
    masterStatus: args.masterStatus ?? "manifest-only",
    category: args.category,
    colorSlug,
    face,
    sourceKitKey: args.sourceKitKey,
    editableMasterPath: args.editableMasterPath,
    assets: { baseSrc, cutoutSrc, detailMaskSrc: args.detailMaskSrc },
    normalizedFrame: args.normalizedFrame,
    printZone: args.printZone,
    protectedDetails: PROTECTED_DETAILS[args.category],
    warp: CATEGORY_DEFAULTS[args.category],
    masks: {
      shadow: "source-luminance-multiply",
      highlight: "source-luminance-screen",
      clipToPrintZone: true,
      preserveProtectedDetails: true,
      duplicateBasePass: false,
    },
    // The source kits already carry product lighting. Keep synthetic passes
    // restrained and never use a duplicate full-frame garment as a mask.
    shading: {
      multiplyOpacity: 0.06,
      screenOpacity: 0.025,
      grainOpacity: 0.02,
    },
  };
}
