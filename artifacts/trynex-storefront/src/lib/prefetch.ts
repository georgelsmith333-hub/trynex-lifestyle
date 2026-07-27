// Lightweight route/asset prefetch helpers.
// Called on hover/touchstart of navigation links so the heavy Design Studio
// chunk (and its default garment mockup images) starts downloading before
// the user actually clicks, eliminating the "hangs on navigation" stall.

let designStudioPrefetched = false;

export function prefetchDesignStudio(): void {
  if (designStudioPrefetched) return;
  designStudioPrefetched = true;
  // Kick off the lazy chunk download.
  import("@/pages/DesignStudio").catch(() => {
    // Ignore — the real navigation will retry via lazyWithRetry.
    designStudioPrefetched = false;
  });
  // Warm the browser cache for the default (t-shirt) garment mockup images
  // so the first render of the studio canvas doesn't wait on a cold image
  // fetch. Uses Image() so it never re-triggers React rendering.
  try {
    [
      "/mockups/white-tshirt-front-cutout.png",
      "/mockups/white-tshirt-back-cutout.png",
    ].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  } catch {
    // Non-critical — ignore.
  }
}
