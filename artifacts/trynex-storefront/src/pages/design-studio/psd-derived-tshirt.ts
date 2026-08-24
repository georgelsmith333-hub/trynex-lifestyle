import type { SmartMockupManifest } from "./smart-mockup-manifest";

export interface PsdDerivedTshirtStagingProfile {
  sourceKey: "tshirt:white:front";
  supportedColors: readonly ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"];
  supportedFaces: readonly ["front", "back"];
  previewMode: "isolated-staging-only";
  cartEnabled: false;
  exportEnabled: false;
  customerRuntimeEnabled: false;
  requiredEffectStack: readonly ["multiply:0.77", "screen:0.38"];
}

/**
 * A provenance-safe description of the licensed PSD source process for the
 * pending T-shirt front master. The browser never receives the PSD/PSB; it can
 * receive only a separately reviewed 1024px PNG export after the full v9 gate
 * accepts every canonical surface.
 */
export interface PsdDerivedTshirtWorkflow {
  sourceKey: "tshirt:white:front";
  releaseStatus: "staging-only" | "accepted";
  source: {
    provider: "GraphicBurger";
    listingUrl: string;
    licenseUrl: string;
    masterFormat: "psd";
    embeddedSmartObjectFormat: "psb";
  };
  composition: {
    smartObjectBlend: "multiply";
    smartObjectCanvas: { width: 3043; height: 2925 };
    parentSmartObjectBounds: { x: 536; y: 343; w: 2985; h: 2868 };
    storedSmartObjectWarp: "flat-affine";
    displacementMap: "auxiliary-requires-calibration";
    sourceEffectStack: readonly ["multiply:0.77", "screen:0.38"];
    requiresValidatedDisplacement: true;
    requiresOutputReview: true;
  };
  runtime: {
    output: "reviewed-1024-rgba-png";
    allowPartialActivation: false;
    allowPsdOrPsbInBrowser: false;
  };
}

export const PSD_DERIVED_TSHIRT_FRONT_WORKFLOW: PsdDerivedTshirtWorkflow = {
  sourceKey: "tshirt:white:front",
  releaseStatus: "staging-only",
  source: {
    provider: "GraphicBurger",
    listingUrl: "https://graphicburger.com/t-shirt-mockup-psd-4/",
    licenseUrl: "https://graphicburger.com/license/",
    masterFormat: "psd",
    embeddedSmartObjectFormat: "psb",
  },
  composition: {
    smartObjectBlend: "multiply",
    smartObjectCanvas: { width: 3043, height: 2925 },
    parentSmartObjectBounds: { x: 536, y: 343, w: 2985, h: 2868 },
    storedSmartObjectWarp: "flat-affine",
    displacementMap: "auxiliary-requires-calibration",
    sourceEffectStack: ["multiply:0.77", "screen:0.38"],
    requiresValidatedDisplacement: true,
    requiresOutputReview: true,
  },
  runtime: {
    output: "reviewed-1024-rgba-png",
    allowPartialActivation: false,
    allowPsdOrPsbInBrowser: false,
  },
};

/**
 * The first rollout surface is intentionally limited to one licensed derived
 * white-front source. This profile cannot be used as a production-release
 * switch: it has neither accepted material-effect URLs nor a customer runtime
 * permission. It exists to keep a staged preview's boundaries explicit.
 */
export const PSD_DERIVED_TSHIRT_STAGING_PROFILE: PsdDerivedTshirtStagingProfile = {
  sourceKey: "tshirt:white:front",
  supportedColors: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
  supportedFaces: ["front", "back"],
  previewMode: "isolated-staging-only",
  cartEnabled: false,
  exportEnabled: false,
  customerRuntimeEnabled: false,
  requiredEffectStack: ["multiply:0.77", "screen:0.38"],
};

/** A source manifest remains unchanged until an accepted flat runtime asset exists. */
export function isPsdDerivedTshirtReadyForRuntime(
  workflow: PsdDerivedTshirtWorkflow,
  manifest: SmartMockupManifest,
): boolean {
  return workflow.releaseStatus === "accepted"
    && workflow.composition.requiresValidatedDisplacement
    && workflow.composition.requiresOutputReview
    && workflow.runtime.output === "reviewed-1024-rgba-png"
    && manifest.category === "tshirt"
    && manifest.face === "front"
    && manifest.sourceKitKey === workflow.sourceKey;
}
