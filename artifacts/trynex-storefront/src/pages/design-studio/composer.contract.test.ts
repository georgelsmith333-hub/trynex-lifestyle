import { describe, expect, it, vi } from "vitest";
import { composeMockupSurface, composeMockupSurfaceTexture, loadImage, type UnifiedMockupSurface } from "./composer";

const surface = (overrides: Partial<UnifiedMockupSurface> = {}): UnifiedMockupSurface => ({
  sourceKitKey: "tshirt:white:front",
  manifestRevision: "source-matrix-v3",
  runtimeStatus: "approved",
  contractErrors: [],
  alphaMode: "transparent-cutout",
  baseSrc: "/mockups/source-matrix-v3/tshirt/white/front.png",
  printZone: { x: 200, y: 200, w: 600, h: 600 },
  ...overrides,
});

describe("unified mockup compositor contract", () => {
  it("rejects disabled surfaces before touching the canvas", async () => {
    await expect(composeMockupSurface({
      canvas: {} as HTMLCanvasElement,
      surface: surface({ runtimeStatus: "disabled", disabledReason: "Awaiting visual review." }),
      garmentColor: "#ffffff",
      layers: [],
      outSize: 400,
    })).rejects.toThrow("Awaiting visual review.");
  });

  it("rejects validation errors and missing base assets for both full and texture paths", async () => {
    await expect(composeMockupSurface({
      canvas: {} as HTMLCanvasElement,
      surface: surface({ contractErrors: ["source-kit key mismatch"] }),
      garmentColor: "#ffffff",
      layers: [],
      outSize: 400,
    })).rejects.toThrow("source-kit key mismatch");

    await expect(composeMockupSurface({
      canvas: {} as HTMLCanvasElement,
      surface: surface({ baseSrc: "" }),
      garmentColor: "#ffffff",
      layers: [],
      outSize: 400,
    })).rejects.toThrow("has no runtime asset");

    await expect(composeMockupSurfaceTexture({
      canvas: {} as HTMLCanvasElement,
      surface: surface({ contractErrors: ["missing printable mask"] }),
      layers: [],
      outSize: 1024,
    })).rejects.toThrow("missing printable mask");
  });

  it("propagates an artwork image load failure instead of drawing a placeholder", async () => {
    class FailingImage {
      complete = false;
      naturalWidth = 0;
      onload: (() => void) | null = null;
      onerror: ((error: Error) => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.(new Error("artwork unavailable")));
      }
    }
    vi.stubGlobal("Image", FailingImage);

    await expect(loadImage("/missing-artwork.png")).rejects.toThrow("artwork unavailable");
    vi.unstubAllGlobals();
  });
});