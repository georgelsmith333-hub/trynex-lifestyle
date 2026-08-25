import { describe, expect, it } from "vitest";
import { createSmartMockupManifest } from "./smart-mockup-manifest";
import {
  isPsdDerivedTshirtReadyForRuntime,
  isPsdDerivedTshirtCustomerReleaseSurface,
  PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE,
  PSD_DERIVED_TSHIRT_STAGING_PROFILE,
  PSD_DERIVED_TSHIRT_FRONT_WORKFLOW,
} from "./psd-derived-tshirt";
import { PRODUCTS, resolveMockup } from "./mockups";

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

  it("defines a customer-ready T-shirt-only PNG release without activating smart-v9 or exposing PSD sources", () => {
    expect(PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.supportedColors).toHaveLength(8);
    expect(PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.supportedFaces).toEqual(["front", "back"]);
    expect(PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.customerRuntimeEnabled).toBe(true);
    expect(PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.activatesSmartV9).toBe(false);
    expect(PSD_DERIVED_TSHIRT_CUSTOMER_RELEASE.allowsPsdOrPsbInBrowser).toBe(false);
    expect(isPsdDerivedTshirtCustomerReleaseSurface("black", "back")).toBe(true);
    expect(isPsdDerivedTshirtCustomerReleaseSurface("white", "left-sleeve")).toBe(false);
  });

  it("keeps each reviewed PSD-derived color base exact through the runtime resolver", () => {
    const tshirt = PRODUCTS.find((product) => product.category === "tshirt");
    expect(tshirt).toBeDefined();

    for (const color of tshirt!.colors) {
      for (const face of ["front", "back"] as const) {
        const resolution = resolveMockup(tshirt!, color.hex, face);
        expect(resolution.cutoutSrc).toContain("/mockups/psd-tshirt-v1/");
        expect(resolution.isColorPhoto).toBe(true);
        expect(resolution.cutoutNeedsTint).toBe(false);
        expect(resolution.requiresTint).toBe(false);
      }
    }
  });

  it("does not apply the shared white screen effect to dark T-shirt colorways", () => {
    const tshirt = PRODUCTS.find((product) => product.category === "tshirt")!;
    for (const colorName of ["Black", "Navy", "Maroon"]) {
      const color = tshirt.colors.find((entry) => entry.name === colorName)!;
      const effects = resolveMockup(tshirt, color.hex, "front").psdMaterialEffects ?? [];
      expect(effects.find((effect) => effect.blendMode === "screen")?.opacity).toBe(0);
      expect(effects.find((effect) => effect.blendMode === "multiply")?.opacity).toBe(0.35);
    }
    const white = tshirt.colors.find((entry) => entry.name === "White")!;
    const whiteEffects = resolveMockup(tshirt, white.hex, "front").psdMaterialEffects ?? [];
    expect(whiteEffects.find((effect) => effect.blendMode === "screen")?.opacity).toBeGreaterThan(0);
  });
});
