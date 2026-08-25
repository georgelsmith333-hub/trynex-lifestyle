import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile Design Studio upload workflow", () => {
  it("opens the selected image's edit controls after a successful upload", () => {
    const source = readFileSync(new URL("./DesignStudioV2.tsx", import.meta.url), "utf8");
    const uploadHandler = source.slice(source.indexOf("const handleFileUpload"), source.indexOf("const replaceSelectedImage"));

    expect(uploadHandler).toContain('setActiveTab("upload")');
    expect(uploadHandler).toContain("setMobileToolOpen(true)");
    expect(uploadHandler).not.toContain('setActiveTab("layers")');
  });

  it("keeps a direct route from image tools into the approved AI reference workflow", () => {
    const studio = readFileSync(new URL("./DesignStudioV2.tsx", import.meta.url), "utf8");
    const imagePanel = readFileSync(new URL("./panels/ImagePanel.tsx", import.meta.url), "utf8");

    expect(studio).toContain('onOpenAiReference={() => setActiveTab("ai")}');
    expect(imagePanel).toContain("Refine this image with AI");
    expect(imagePanel).toContain("AI reference edits require your approval");
  });
});
