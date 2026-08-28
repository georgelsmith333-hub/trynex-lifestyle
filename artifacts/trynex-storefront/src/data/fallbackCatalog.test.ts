import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FALLBACK_FEATURED_PRODUCTS, toPlaceholderProducts } from "./fallbackCatalog";

describe("offline family catalogue", () => {
  it("covers the six live product families with shop and studio links", () => {
    expect(FALLBACK_FEATURED_PRODUCTS.map((item) => item.categoryName)).toEqual([
      "T-Shirts",
      "Hoodies",
      "Mugs",
      "Caps",
      "Long Sleeves",
      "Water Bottles",
    ]);
    for (const item of FALLBACK_FEATURED_PRODUCTS) {
      expect(item.shopHref.startsWith("/products")).toBe(true);
      expect(item.studioHref.startsWith("/design-studio")).toBe(true);
      expect(item.imageUrl.startsWith("/mockups/")).toBe(true);
    }
    expect(toPlaceholderProducts()).toHaveLength(6);
  });

  it("homes the featured grid on the fallback when the live catalogue is empty", () => {
    const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
    expect(home).toContain("FALLBACK_FEATURED_PRODUCTS");
    expect(home).toContain("FallbackProductCard");
    expect(home).toContain("catalogWaited");
    expect(home).toContain("button-retry-featured-products");
  });
});
