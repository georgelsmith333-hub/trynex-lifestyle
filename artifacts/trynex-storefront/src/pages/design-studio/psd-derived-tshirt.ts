import type { SmartMockupManifest } from "./smart-mockup-manifest";

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
