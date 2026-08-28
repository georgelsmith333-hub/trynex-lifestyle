import { describe, expect, it } from "vitest";
import { getApparelZones, getZonePZ, PRODUCTS, resolveMockup, setRuntimeMockupOverrides } from "./mockups";
import { getSourceMatrixV3Entry, validateSourceMatrixV3 } from "./source-matrix-v3";

describe("Hoodie source matrix v3", () => {
  it("declares every verified colour and apparel view as a browser-only derivative", () => {
    expect(validateSourceMatrixV3()).toEqual([]);
  });

  it("resolves every Hoodie colour and view to the live smart-v9 PNG", () => {
    const family = "hoodie";
    const product = PRODUCTS.find((candidate) => candidate.category === family)!;
    for (const colour of product.colors) for (const face of ["front", "back", "left-sleeve", "right-sleeve", "neck-label"] as const) {
      const resolved = resolveMockup(product, colour.hex, face);
      const sourceColour = resolved.sourceKitKey.split(":")[1]!;
      expect(resolved.photoSrc).toBe(`/mockups/smart-v9/hoodie/${sourceColour}/${face}.png`);
      expect(resolved.cutoutSrc).toBe(resolved.photoSrc);
      expect(resolved.photoSrc).not.toContain("smart-v4");
      expect(resolved.isColorPhoto).toBe(true);
      expect(resolved.requiresTint).toBe(false);
    }
  });

  it("uses the live 188-matrix print zones through canvas-layer helpers", () => {
    const longsleeve = PRODUCTS.find((product) => product.category === "longsleeve")!;
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    expect(getZonePZ("back", longsleeve, longsleeve.colors[0]!.hex)).toEqual({ x: 292, y: 195, w: 416, h: 458 });
    expect(getZonePZ("front", hoodie, hoodie.colors[0]!.hex)).toEqual({ x: 240, y: 270, w: 520, h: 400 });
    expect(getApparelZones("hoodie", hoodie.printZone, hoodie.printZoneBack, hoodie.colors[0]!.hex).find((zone) => zone.face === "left-sleeve")?.isFlat)
      .toBe(false);
    expect(getApparelZones("hoodie", hoodie.printZone, hoodie.printZoneBack, hoodie.colors[0]!.hex).find((zone) => zone.face === "left-sleeve")?.pz)
      .toEqual({ x: 175, y: 175, w: 650, h: 650 });
  });

  it("keeps the source-matrix v3 catalogue valid without exposing it on the live canvas", () => {
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    expect(getSourceMatrixV3Entry("hoodie", "navy", "front")?.assetPath).toBe("/mockups/source-matrix-v3/hoodie/navy/front.jpg");
    expect(resolveMockup(hoodie, "#1e3a5f", "front").photoSrc).toBe("/mockups/smart-v9/hoodie/navy/front.png");
  });

  it("rejects stale runtime smart-v4 metadata for live Hoodie v9 surfaces", () => {
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    try {
      setRuntimeMockupOverrides([{ sourceKitKey: "hoodie/navy/front", imageUrl: "/mockups/smart-v4/hoodie/navy/front.png?v=smart-v4", ingestionStatus: "ready" }]);
      expect(resolveMockup(hoodie, "#1e3a5f", "front").photoSrc).toBe("/mockups/smart-v9/hoodie/navy/front.png");
    } finally {
      setRuntimeMockupOverrides([]);
    }
  });

  it("labels the live Hoodie white blank as White", () => {
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    expect(hoodie.colors[0]).toEqual({ name: "White", hex: "#F5F5F3" });
  });
});
