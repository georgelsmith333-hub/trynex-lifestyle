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

  it("routes Water Bottle Front and Back through the verified v1.1 candidate assets", () => {
    const bottle = PRODUCTS.find((product) => product.id === "waterbottle");
    expect(bottle).toBeDefined();
    expect(resolveMockup(bottle!, bottle!.colors[0]!.hex, "front").photoSrc).toBe(
      WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.front.url,
    );
    expect(resolveMockup(bottle!, bottle!.colors[0]!.hex, "back").photoSrc).toBe(
      WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.back.url,
    );
  });

  it("rejects a stale ready Water Bottle gallery record instead of requesting smart-v4", () => {
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
        WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets.front.url,
      );
    } finally {
      setRuntimeMockupOverrides([]);
    }
  });
});
