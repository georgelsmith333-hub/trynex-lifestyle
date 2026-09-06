import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCTS, getApparelZones, getZonePZ, resolveMockup, setRuntimeMockupOverrides } from "./mockups";
import { getSourceMatrixV4LongSleeveEntry, validateSourceMatrixV4LongSleeve } from "./source-matrix-v4";
import { getSmartV10RuntimeRoles } from "./smart-v10-runtime";

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

  it("uses the accepted Smart v10.3 Long Sleeve surfaces after promotion", () => {
    const product = PRODUCTS.find((candidate) => candidate.id === "longsleeve");
    if (!product) throw new Error("fixture requires Long Sleeve");
    for (const colour of product.colors) for (const face of faces) {
      const entry = getSourceMatrixV4LongSleeveEntry(
        colour.name.toLowerCase().replaceAll(" ", "-"),
        face,
      );
      const resolved = resolveMockup(product, colour.hex, face);
      const sourceColour = colour.name.toLowerCase().replaceAll(" ", "-");
      expect(resolved.photoSrc).toBe(
        getSmartV10RuntimeRoles("longsleeve", sourceColour, face).base,
      );
      expect(resolved.cutoutSrc).toBe(resolved.photoSrc);
      expect(resolved.printZone).toEqual(entry?.printZone);
      expect(resolved.normalizedFrame).toEqual(entry?.normalizedFrame);
      expect(resolved.editableMasterPath).toBe(entry?.editableMasterPath);
    }
    expect(getApparelZones("longsleeve", product.printZone, product.printZoneBack, product.colors[0]?.hex).map((zone) => zone.pz))
      .toEqual(faces.map((face) => getSourceMatrixV4LongSleeveEntry("white", face)!.printZone));
    expect(getZonePZ("front", product, product.colors[4]?.hex)).toEqual(getSourceMatrixV4LongSleeveEntry("navy", "front")!.printZone);
  });

  it("routes the accepted Hoodie source-matrix v3 geometry through v10.3 runtime assets", () => {
    const hoodie = PRODUCTS.find((candidate) => candidate.id === "hoodie");
    if (!hoodie) throw new Error("fixture requires Hoodie");
    expect(resolveMockup(hoodie, "#d2bd88", "front").photoSrc)
      .toBe("/mockups/psd-master-v10/runtime-roles/hoodie/sand/front-base.png");
  });

  it("keeps accepted Smart v10.3 ahead of stale Long Sleeve overrides", () => {
    const longsleeve = PRODUCTS.find((candidate) => candidate.id === "longsleeve");
    if (!longsleeve) throw new Error("fixture requires Long Sleeve");
    try {
      setRuntimeMockupOverrides([{
        sourceKitKey: "longsleeve/navy/front",
         imageUrl: "/mockups/retired-preview/longsleeve/navy/front.png",
        ingestionStatus: "ready",
      }]);
        expect(resolveMockup(longsleeve, "#1e3a5f", "front").photoSrc)
          .toBe(getSmartV10RuntimeRoles("longsleeve", "navy", "front").base);
    } finally {
      setRuntimeMockupOverrides([]);
    }
  });
});
