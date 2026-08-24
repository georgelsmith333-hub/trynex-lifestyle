import { describe, expect, it } from "vitest";
import { createSmartMockupManifest } from "./smart-mockup-manifest";
import {
  isPsdDerivedTshirtReadyForRuntime,
  PSD_DERIVED_TSHIRT_STAGING_PROFILE,
  PSD_DERIVED_TSHIRT_FRONT_WORKFLOW,
} from "./psd-derived-tshirt";

describe("licensed PSD-derived T-shirt workflow", () => {
  it("documents the native smart-object stack but keeps the partial source out of runtime", () => {
    const manifest = createSmartMockupManifest({
      category: "tshirt",
      sourceKitKey: "tshirt:white:front",
      normalizedFrame: { canvasWidth: 1024, canvasHeight: 1024, x: 43, y: 66, w: 937, h: 891 },
      printZone: { x: 240, y: 185, w: 520, h: 580 },
    });

    expect(PSD_DERIVED_TSHIRT_FRONT_WORKFLOW.source.embeddedSmartObjectFormat).toBe("psb");
    expect(PSD_DERIVED_TSHIRT_FRONT_WORKFLOW.composition.storedSmartObjectWarp).toBe("flat-affine");
    expect(PSD_DERIVED_TSHIRT_FRONT_WORKFLOW.composition.displacementMap).toBe("auxiliary-requires-calibration");
    expect(PSD_DERIVED_TSHIRT_FRONT_WORKFLOW.composition.sourceEffectStack).toEqual(["multiply:0.77", "screen:0.38"]);
    expect(PSD_DERIVED_TSHIRT_FRONT_WORKFLOW.runtime.allowPsdOrPsbInBrowser).toBe(false);
    expect(isPsdDerivedTshirtReadyForRuntime(PSD_DERIVED_TSHIRT_FRONT_WORKFLOW, manifest)).toBe(false);
  });

  it("limits the PSD-native rollout to audited front/back T-shirt staging profiles, not customer runtime", () => {
    expect(PSD_DERIVED_TSHIRT_STAGING_PROFILE.supportedColors).toEqual(["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"]);
    expect(PSD_DERIVED_TSHIRT_STAGING_PROFILE.supportedFaces).toEqual(["front", "back"]);
    expect(PSD_DERIVED_TSHIRT_STAGING_PROFILE.requiredEffectStack).toEqual(["multiply:0.77", "screen:0.38"]);
    expect(PSD_DERIVED_TSHIRT_STAGING_PROFILE.cartEnabled).toBe(false);
    expect(PSD_DERIVED_TSHIRT_STAGING_PROFILE.exportEnabled).toBe(false);
    expect(PSD_DERIVED_TSHIRT_STAGING_PROFILE.customerRuntimeEnabled).toBe(false);
  });
});
