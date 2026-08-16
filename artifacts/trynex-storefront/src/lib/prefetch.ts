// Lightweight route/asset prefetch helpers.
// Called on hover/touchstart of navigation links so the heavy Design Studio
// chunk (and its default garment mockup images) starts downloading before
// the user actually clicks, eliminating the "hangs on navigation" stall.

let designStudioPrefetched = false;

export function prefetchDesignStudio(): void {
  if (designStudioPrefetched) return;
  designStudioPrefetched = true;
  // Kick off the lazy chunk download.
  import("@/pages/studio/DesignStudioV2").catch(() => {
    // Ignore — the real navigation will retry via lazyWithRetry.
    designStudioPrefetched = false;
  });
  // Warm one canonical front/back pair per product family so the active
  // V2 studio resolves v3 assets without falling back to legacy cutouts.
  try {
    [
      "/mockups/source-kit-v3/tshirt/white/front.png",
      "/mockups/source-kit-v3/tshirt/white/back.png",
      "/mockups/source-kit-v3/longsleeve/white/front.png",
      "/mockups/source-kit-v3/longsleeve/white/back.png",
      "/mockups/source-kit-v3/hoodie/white/front.png",
      "/mockups/source-kit-v3/hoodie/white/back.png",
      "/mockups/source-kit-v3/mug/white/front.png",
      "/mockups/source-kit-v3/mug/white/back.png",
      "/mockups/source-kit-v3/cap/white/front.png",
      "/mockups/source-kit-v3/cap/white/back.png",
      "/mockups/source-kit-v3/waterbottle/white/front.png",
      "/mockups/source-kit-v3/waterbottle/white/back.png",
    ].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  } catch {
    // Non-critical — ignore.
  }
}
