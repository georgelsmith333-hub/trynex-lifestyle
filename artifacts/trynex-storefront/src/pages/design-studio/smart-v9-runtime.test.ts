import { describe, expect, it } from "vitest";
import { COMPLETE_MOCKUP_MATRIX } from "./complete-mockup-matrix";
import {
  PRODUCTS,
  getActiveMockupReleaseVersion,
  getApparelZones,
  getProductPickerPreviewSrc,
  resolveMockup,
} from "./mockups";

describe("live smart-v9 Design Studio", () => {
  it("activates smart-v9 for every canonical 188-surface key", () => {
    expect(getActiveMockupReleaseVersion()).toBe("smart-v9");
    for (const product of PRODUCTS) {
      for (const colour of product.colors) {
        const resolved = resolveMockup(product, colour.hex, "front");
        expect(resolved.photoSrc).toMatch(/^\/mockups\/smart-v9\//);
        expect(resolved.cutoutSrc).toBe(resolved.photoSrc);
        expect(resolved.isColorPhoto).toBe(true);
        expect(resolved.requiresTint).toBe(false);
      }
    }
  });

  it("keeps Water Bottle on the authentic hash-pinned white surfaces", () => {
    const bottle = PRODUCTS.find((product) => product.id === "waterbottle")!;
    expect(resolveMockup(bottle, bottle.colors[0]!.hex, "front").photoSrc)
      .toBe("/mockups/smart-v9/waterbottle/white/front.png");
    expect(resolveMockup(bottle, bottle.colors[0]!.hex, "back").photoSrc)
      .toBe("/mockups/smart-v9/waterbottle/white/back.png");
    expect(bottle.colors).toHaveLength(1);
  });

  it("shows sleeve and neck on the real product photo instead of a flat artboard", () => {
    const tshirt = PRODUCTS.find((product) => product.id === "tshirt")!;
    const zones = getApparelZones("tshirt", tshirt.printZone, tshirt.printZoneBack, tshirt.colors[0]!.hex);
    expect(zones.every((zone) => zone.isFlat === false)).toBe(true);
    expect(resolveMockup(tshirt, tshirt.colors[0]!.hex, "left-sleeve").photoSrc)
      .toBe("/mockups/smart-v9/tshirt/white/left-sleeve.png");
  });

  it("covers every matrix key from the live product picker colours", () => {
    const seen = new Set<string>();
    for (const product of PRODUCTS) {
      for (const colour of product.colors) {
        const views = COMPLETE_MOCKUP_MATRIX
          .filter((entry) => entry.family === product.category)
          .map((entry) => entry.view)
          .filter((view, index, all) => all.indexOf(view) === index);
        for (const view of views) {
          const resolved = resolveMockup(product, colour.hex, view);
          seen.add(resolved.sourceKitKey ?? "");
        }
      }
    }
    expect(seen.size).toBe(COMPLETE_MOCKUP_MATRIX.length);
  });

  it("points the product picker at the same white-front v9 photo as the canvas", () => {
    const tshirt = PRODUCTS.find((product) => product.id === "tshirt")!;
    expect(getProductPickerPreviewSrc(tshirt)).toBe("/mockups/smart-v9/tshirt/white/front.png");
  });
});
