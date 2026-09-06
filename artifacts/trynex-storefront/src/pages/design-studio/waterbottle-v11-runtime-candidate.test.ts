import { describe, expect, it } from "vitest";
import { PRODUCTS, resolveMockup, setRuntimeMockupOverrides } from "./mockups";
import {
  validateWaterBottleV11RuntimeCandidate,
  WATER_BOTTLE_V11_RUNTIME_CANDIDATE,
} from "./waterbottle-v11-runtime-candidate";

describe("Water Bottle v1.1 runtime candidate", () => {
  it("keeps its reviewed Front and Back assets neutral, hash-pinned, and non-activating", () => {
    expect(() => validateWaterBottleV11RuntimeCandidate()).not.toThrow();
    expect(WATER_BOTTLE_V11_RUNTIME_CANDIDATE.runtimeActivationAllowed).toBe(false);
    expect(WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.front.fixedProductClaims).toEqual([]);
    expect(WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.back.fixedProductClaims).toEqual([]);
  });

  it("routes Water Bottle Front and Back through the accepted Smart v10.3 surfaces", () => {
    const bottle = PRODUCTS.find((product) => product.id === "waterbottle");
    expect(bottle).toBeDefined();
    expect(resolveMockup(bottle!, bottle!.colors[0]!.hex, "front").photoSrc)
      .toBe("/mockups/psd-master-v10/runtime-roles/waterbottle/white/front-base.png");
    expect(resolveMockup(bottle!, bottle!.colors[0]!.hex, "back").photoSrc)
      .toBe("/mockups/psd-master-v10/runtime-roles/waterbottle/white/back-base.png");
  });

  it("keeps accepted Smart v10.3 ahead of a stale Water Bottle gallery record", () => {
    const bottle = PRODUCTS.find((product) => product.id === "waterbottle");
    expect(bottle).toBeDefined();

    try {
      setRuntimeMockupOverrides([
        {
          sourceKitKey: "waterbottle/white/front",
          imageUrl: "/mockups/smart-v4/waterbottle/white/front.png?v=smart-v4",
          ingestionStatus: "ready",
        },
      ]);

      expect(resolveMockup(bottle!, bottle!.colors[0]!.hex, "front").photoSrc).toBe(
        "/mockups/psd-master-v10/runtime-roles/waterbottle/white/front-base.png",
      );
    } finally {
      setRuntimeMockupOverrides([]);
    }
  });

  it("keeps accepted Smart v10.3 T-shirt surfaces ahead of stale gallery metadata", () => {
    const tshirt = PRODUCTS.find((product) => product.id === "tshirt");
    expect(tshirt).toBeDefined();

    try {
      setRuntimeMockupOverrides([
        {
          sourceKitKey: "tshirt/navy/front",
          imageUrl: "/mockups/smart-v4/tshirt/navy/front.png?v=smart-v4",
          ingestionStatus: "ready",
        },
      ]);

      expect(resolveMockup(tshirt!, "#1e3a5f", "front").photoSrc).toBe(
        "/mockups/psd-master-v10/runtime-roles/tshirt/navy/front-base.png",
      );
    } finally {
      setRuntimeMockupOverrides([]);
    }
  });
});
