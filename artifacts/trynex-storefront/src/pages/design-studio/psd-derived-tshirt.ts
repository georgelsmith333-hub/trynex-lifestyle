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
 * Customer-runtime boundary for reviewed derived PNG outputs only. This is a
 * T-shirt-specific source release; it cannot change another product family or
 * transfer the licensed PSD/PSB into the browser.
 */
export interface PsdDerivedTshirtCustomerRelease {
  version: "psd-tshirt-v1";
  supportedColors: readonly ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"];
  supportedFaces: readonly ["front", "back"];
  assetRoot: "/mockups/psd-tshirt-v1";
  cartEnabled: true;
  exportEnabled: true;
  customerRuntimeEnabled: true;
  allowsPsdOrPsbInBrowser: false;
  displacementStatus: "not-claimed-as-native-photoshop";
}

/**
 * A provenance-safe description of the licensed PSD source process. The
 * browser never receives the PSD/PSB: only separately reviewed PNG derivatives
 * may be supplied to either the staging path or the T-shirt-only release.
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
 * The local review profile cannot be used as a production-release switch.
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

export const PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE: PsdDerivedTshirtCustomerRelease = {
  version: "psd-tshirt-v1",
  supportedColors: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
  supportedFaces: ["front", "back"],
  assetRoot: "/mockups/psd-tshirt-v1",
  cartEnabled: true,
  exportEnabled: true,
  customerRuntimeEnabled: true,
  allowsPsdOrPsbInBrowser: false,
  displacementStatus: "not-claimed-as-native-photoshop",
};

export function isPsdDerivedTshirtCustomerReleaseSurface(color: string, face: string): boolean {
  return PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.supportedColors.includes(color as never)
    && PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.supportedFaces.includes(face as never);
}

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
