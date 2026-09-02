import { describe, expect, it } from "vitest";
import { COMPLETE_MOCKUP_MATRIX } from "./complete-mockup-matrix";
import {
  activateSmartV9Release,
  getProductPickerFallbackSrc,
  getProductPickerPreviewSrc,
  PRODUCTS,
} from "./mockups";
import { AUTHENTIC_WATER_BOTTLE_SHA256_BY_SOURCE_KEY } from "./smart-v9-release";

function acceptedCandidate() {
  return {
    version: "smart-v9" as const,
    visualGatePassed: true,
    technicalGatePassed: true,
    assets: COMPLETE_MOCKUP_MATRIX.map((entry) => ({
      sourceKey: entry.sourceKey,
      assetUrl: entry.assetPath.replace("/mockups/smart-v4/", "/mockups/smart-v9/"),
      sha256: entry.family === "waterbottle"
        ? AUTHENTIC_WATER_BOTTLE_SHA256_BY_SOURCE_KEY[entry.sourceKey]
        : "a".repeat(64),
      status: "accepted" as const,
      provenance: entry.family === "waterbottle" ? "authentic-preserved" as const : "generated-master" as const,
    })),
  };
}

describe("smart-v9 product picker previews", () => {
  it("keeps the curated picker asset until activation, then uses the accepted v9 surface", () => {
    const tshirt = PRODUCTS.find((product) => product.id === "tshirt");
    if (!tshirt) throw new Error("fixture requires the T-shirt product");

    expect(getProductPickerPreviewSrc(tshirt)).toBe(tshirt.gallerySrc ?? tshirt.frontSrc);
    expect(getProductPickerFallbackSrc(tshirt)).toBe(tshirt.frontSrc);

    activateSmartV9Release(acceptedCandidate());

    expect(getProductPickerPreviewSrc(tshirt)).toBe("/mockups/smart-v9/tshirt/white/front.png");
    expect(getProductPickerFallbackSrc(tshirt)).toBeUndefined();
  });
});
