import { describe, expect, it } from "vitest";
import { getApparelZones, getSmartV9ColorSlug, getZonePZ, PRODUCTS, resolveMockup, setRuntimeMockupOverrides } from "./mockups";
import { getSourceMatrixV3Entry, validateSourceMatrixV3 } from "./source-matrix-v3";

describe("Hoodie source matrix v3", () => {
  it("declares every verified colour and apparel view as a browser-only derivative", () => {
    expect(validateSourceMatrixV3()).toEqual([]);
  });

  it("resolves every Hoodie colour and view to the accepted smart-v9 PNG", () => {
    const family = "hoodie";
    const product = PRODUCTS.find((candidate) => candidate.category === family)!;
    for (const colour of product.colors) for (const face of ["front", "back", "left-sleeve", "right-sleeve", "neck-label"] as const) {
      const resolved = resolveMockup(product, colour.hex, face);
      const sourceColour = resolved.sourceKitKey.split(":")[1]!;
      const entry = getSourceMatrixV3Entry(family, sourceColour, face);
      expect(entry).toBeDefined();
      const smartV9Colour = getSmartV9ColorSlug(family, sourceColour);
      const expectedAsset = smartV9Colour
        ? `/mockups/smart-v9/hoodie/${smartV9Colour}/${face}.png`
        : entry!.assetPath;
      expect(resolved.photoSrc).toBe(expectedAsset);
      expect(resolved.cutoutSrc).toBe(expectedAsset);
      if (smartV9Colour) {
        expect(resolved.photoSrc).toMatch(/^\/mockups\/smart-v9\/hoodie\//);
        expect(resolved.photoSrc).not.toContain("smart-v4");
      }
      expect(resolved.editableMasterPath).toMatch(/^quarantine\/source-matrix-v3\//);
      expect(resolved.printZone).toEqual(entry!.printZone);
    }
  });

  it("uses exact source zones through canvas-layer helpers", () => {
    const longsleeve = PRODUCTS.find((product) => product.category === "longsleeve")!;
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    expect(getZonePZ("back", longsleeve, longsleeve.colors[0]!.hex)).toEqual({ x: 328.5, y: 366.25, w: 328.75, h: 86.25 });
    expect(getZonePZ("front", hoodie, hoodie.colors[0]!.hex)).toEqual({ x: 171.75, y: 121.25, w: 677, h: 737 });
    expect(getApparelZones("hoodie", hoodie.printZone, hoodie.printZoneBack, hoodie.colors[0]!.hex).find((zone) => zone.face === "left-sleeve")?.pz)
      .toEqual({ x: 378.7879, y: 242.4242, w: 212.1212, h: 424.2424 });
  });

  it("routes the corrected Hoodie Sand surface to the verified v3 browser derivative", () => {
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    const sand = hoodie.colors.find((colour) => colour.name === "Sand")!;
    expect(resolveMockup(hoodie, sand.hex, "front").photoSrc).toBe("/mockups/source-matrix-v3/hoodie/sand/front.jpg");
  });

  it("rejects stale runtime smart-v4 metadata for verified Hoodie v3 surfaces", () => {
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    try {
      setRuntimeMockupOverrides([{ sourceKitKey: "hoodie/navy/front", imageUrl: "/mockups/smart-v4/hoodie/navy/front.png?v=smart-v4", ingestionStatus: "ready" }]);
      expect(resolveMockup(hoodie, "#1e3a5f", "front").photoSrc).toBe("/mockups/smart-v9/hoodie/navy/front.png");
    } finally {
      setRuntimeMockupOverrides([]);
    }
  });

  it("labels the photographed accented white Hoodie honestly", () => {
    const hoodie = PRODUCTS.find((product) => product.category === "hoodie")!;
    expect(hoodie.colors[0]).toEqual({ name: "White / Red Trim", hex: "#F2EFE9" });
  });
});
