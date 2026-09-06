import { describe, expect, it } from "vitest";
import {
  getActiveMockupReleaseVersion,
  getProductPickerFallbackSrc,
  getProductPickerPreviewSrc,
  PRODUCTS,
} from "./mockups";

describe("smart-v10.3 product picker previews", () => {
  it("uses the accepted v10.3 surface for product picker previews", () => {
    const tshirt = PRODUCTS.find((product) => product.id === "tshirt");
    if (!tshirt) throw new Error("fixture requires the T-shirt product");

    expect(getProductPickerPreviewSrc(tshirt)).toBe(
      "/mockups/psd-master-v10/runtime-roles/tshirt/white/front-base.png",
    );
    expect(getProductPickerFallbackSrc(tshirt)).toBeUndefined();
    expect(getActiveMockupReleaseVersion()).toBe("smart-v10.3");
  });
});
