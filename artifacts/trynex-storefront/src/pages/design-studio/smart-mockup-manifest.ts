export type SmartMockupCategory = "mug" | "cap" | "waterbottle" | "tshirt" | "longsleeve" | "hoodie";

export interface SmartObjectPrintZone {
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: string;
}

export interface SmartMockupManifest {
  schema: "trynex-smart-mockup/v1";
  masterFormat: "psd" | "psb";
  category: SmartMockupCategory;
  sourceKitKey: string;
  editableMasterPath: string;
  normalizedFrame: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number };
  printZone: SmartObjectPrintZone;
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
    duplicateBasePass: false;
  };
  shading: {
    multiplyOpacity: number;
    screenOpacity: number;
    grainOpacity: number;
  };
}

const CATEGORY_DEFAULTS: Record<SmartMockupCategory, SmartMockupManifest["warp"]> = {
  mug: { mode: "cylinder", curvature: 0.14, seamPadding: 0.035, preserveAspect: true },
  cap: { mode: "cap-panel", curvature: 0.08, seamPadding: 0.025, preserveAspect: true },
  waterbottle: { mode: "cylinder", curvature: 0.19, seamPadding: 0.04, preserveAspect: true },
  tshirt: { mode: "perspective", curvature: 0.035, seamPadding: 0.02, preserveAspect: true },
  longsleeve: { mode: "perspective", curvature: 0.045, seamPadding: 0.02, preserveAspect: true },
  hoodie: { mode: "perspective", curvature: 0.04, seamPadding: 0.02, preserveAspect: true },
};

export function createSmartMockupManifest(args: {
  category: SmartMockupCategory;
  sourceKitKey: string;
  editableMasterPath: string;
  normalizedFrame: SmartMockupManifest["normalizedFrame"];
  printZone: SmartObjectPrintZone;
}): SmartMockupManifest {
  return {
    schema: "trynex-smart-mockup/v1",
    masterFormat: args.category === "waterbottle" || args.category === "mug" ? "psb" : "psd",
    category: args.category,
    sourceKitKey: args.sourceKitKey,
    editableMasterPath: args.editableMasterPath,
    normalizedFrame: args.normalizedFrame,
    printZone: args.printZone,
    warp: CATEGORY_DEFAULTS[args.category],
    masks: {
      shadow: "source-luminance-multiply",
      highlight: "source-luminance-screen",
      clipToPrintZone: true,
      duplicateBasePass: false,
    },
    shading: {
      multiplyOpacity: 0.24,
      screenOpacity: 0.06,
      grainOpacity: 0.025,
    },
  };
}
