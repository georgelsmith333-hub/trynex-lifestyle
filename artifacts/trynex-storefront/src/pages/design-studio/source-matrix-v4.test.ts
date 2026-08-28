import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCTS, getApparelZones, getZonePZ, resolveMockup, setRuntimeMockupOverrides } from "./mockups";
import { getSourceMatrixV4LongSleeveEntry, validateSourceMatrixV4LongSleeve } from "./source-matrix-v4";

const colours = ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"] as const;
const faces = ["front", "back", "left-sleeve", "right-sleeve", "neck-label"] as const;

describe("Long Sleeve source-matrix v4 corrective release", () => {
  it("declares a complete 10-colour by 5-view browser-only matrix", () => {
    expect(validateSourceMatrixV4LongSleeve()).toEqual([]);
    for (const colour of colours) for (const face of faces) {
      const entry = getSourceMatrixV4LongSleeveEntry(colour, face);
      expect(entry?.assetPath).toBe(`/mockups/source-matrix-v4/longsleeve/${colour}/${face}.jpg`);
      expect(entry?.editableMasterPath).toBe(`quarantine/source-matrix-v4/longsleeve/${colour}/${face}.psd`);
      expect(existsSync(resolve(process.cwd(), "public", entry!.assetPath.slice(1)))).toBe(true);
    }
  });

  it("uses live smart-v9 Long Sleeve photos with the 188-matrix print zones", () => {
    const product = PRODUCTS.find((candidate) => candidate.id === "longsleeve");
    if (!product) throw new Error("fixture requires Long Sleeve");
    for (const colour of product.colors) for (const face of faces) {
      const resolved = resolveMockup(product, colour.hex, face);
      const slug = colour.name.toLowerCase().replaceAll(" ", "-");
      expect(resolved.photoSrc).toBe(`/mockups/smart-v9/longsleeve/${slug}/${face}.png`);
      expect(resolved.cutoutSrc).toBe(resolved.photoSrc);
      expect(resolved.isColorPhoto).toBe(true);
    }
    expect(getApparelZones("longsleeve", product.printZone, product.printZoneBack, product.colors[0]?.hex).every((zone) => !zone.isFlat))
      .toBe(true);
    expect(getZonePZ("front", product, product.colors.find((colour) => colour.name === "Navy")?.hex))
      .toEqual({ x: 312, y: 222, w: 376, h: 404 });
  });

  it("does not keep Hoodie on the older source-matrix v3 photo once v9 is live", () => {
    const hoodie = PRODUCTS.find((candidate) => candidate.id === "hoodie");
    if (!hoodie) throw new Error("fixture requires Hoodie");
    expect(resolveMockup(hoodie, "#F5F5F3", "front").photoSrc)
      .toBe("/mockups/smart-v9/hoodie/white/front.png");
  });

  it("rejects stale Long Sleeve smart-v4 metadata in favour of live smart-v9", () => {
    const longsleeve = PRODUCTS.find((candidate) => candidate.id === "longsleeve");
    if (!longsleeve) throw new Error("fixture requires Long Sleeve");
    try {
      setRuntimeMockupOverrides([{
        sourceKitKey: "longsleeve/navy/front",
        imageUrl: "/mockups/smart-v4/longsleeve/navy/front.png?v=smart-v4",
        ingestionStatus: "ready",
      }]);
      expect(resolveMockup(longsleeve, "#1e3a5f", "front").photoSrc)
        .toBe("/mockups/smart-v9/longsleeve/navy/front.png");
    } finally {
      setRuntimeMockupOverrides([]);
    }
  });
});
