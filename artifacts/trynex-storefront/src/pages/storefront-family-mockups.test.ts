import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FALLBACK_FEATURED_PRODUCTS } from "../data/fallbackCatalog";

const files = {
  hero: readFileSync(new URL("../components/home/TypewriterHero.tsx", import.meta.url), "utf8"),
  home: readFileSync(new URL("./Home.tsx", import.meta.url), "utf8"),
  card: readFileSync(new URL("../components/ProductCard.tsx", import.meta.url), "utf8"),
  prefetch: readFileSync(new URL("../lib/prefetch.ts", import.meta.url), "utf8"),
  instagram: readFileSync(new URL("../components/InstagramFeed.tsx", import.meta.url), "utf8"),
};

describe("storefront family mockups use the live smart-v9 kit", () => {
  it("maps each customer-facing family to its own v9 white-front photo", () => {
    const expected = {
      tshirt: "/mockups/smart-v9/tshirt/white/front.png",
      hoodie: "/mockups/smart-v9/hoodie/white/front.png",
      mug: "/mockups/smart-v9/mug/white/front.png",
      cap: "/mockups/smart-v9/cap/white/front.png",
      longsleeve: "/mockups/smart-v9/longsleeve/white/front.png",
      waterbottle: "/mockups/smart-v9/waterbottle/white/front.png",
    };
    for (const source of Object.values(files)) {
      expect(source).not.toContain("/mockups/smart-v4/");
      expect(source).not.toContain("/mockups/waterbottle-v11/");
    }
    expect(files.hero).toContain(expected.tshirt);
    expect(files.hero).toContain(expected.hoodie);
    expect(files.hero).toContain(expected.mug);
    expect(files.hero).toContain(expected.cap);
    expect(files.hero).toContain(expected.longsleeve);
    expect(files.hero).toContain(expected.waterbottle);
    expect(files.home).toContain(expected.tshirt);
    expect(files.card).toContain(expected.mug);
    expect(files.card).toContain(expected.hoodie);
    expect(files.card).toContain(expected.waterbottle);
    expect(files.card).toContain(expected.cap);
    expect(files.card).toContain(expected.longsleeve);
    expect(files.card).toContain(expected.tshirt);
  });

  it("keeps the six-family fallback cards on the same v9 photos", () => {
    expect(FALLBACK_FEATURED_PRODUCTS.map((item) => item.imageUrl)).toEqual([
      "/mockups/smart-v9/tshirt/white/front.png",
      "/mockups/smart-v9/hoodie/white/front.png",
      "/mockups/smart-v9/mug/white/front.png",
      "/mockups/smart-v9/cap/white/front.png",
      "/mockups/smart-v9/longsleeve/white/front.png",
      "/mockups/smart-v9/waterbottle/white/front.png",
    ]);
  });
});
