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
  // V2 studio resolves reviewed sources without falling back to retired previews.
  try {
    [
      "/mockups/smart-v4/tshirt/white/front.png",
      "/mockups/smart-v4/tshirt/white/back.png",
      "/mockups/smart-v4/longsleeve/white/front.png",
      "/mockups/smart-v4/longsleeve/white/back.png",
      "/mockups/smart-v4/hoodie/white/front.png",
      "/mockups/smart-v4/hoodie/white/back.png",
      "/mockups/smart-v4/mug/white/front.png",
      "/mockups/smart-v4/mug/white/back.png",
      "/mockups/smart-v4/cap/white/front.png",
      "/mockups/smart-v4/cap/white/back.png",
      "/mockups/waterbottle-v11/white/front.png",
      "/mockups/waterbottle-v11/white/back.png",
    ].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  } catch {
    // Non-critical — ignore.
  }
}
