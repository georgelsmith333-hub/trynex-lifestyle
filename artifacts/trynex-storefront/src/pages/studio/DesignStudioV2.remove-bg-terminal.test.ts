import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignStudioV2.tsx", import.meta.url), "utf8");

describe("Design Studio background-removal terminal states", () => {
  it("does not fall back after a non-success server response", () => {
    const serverResponseBranch = source.indexOf("} else if (!response.ok)");
    const fallbackBranch = source.indexOf("if (!result) {", serverResponseBranch);
    expect(serverResponseBranch).toBeGreaterThan(-1);
    expect(fallbackBranch).toBeGreaterThan(serverResponseBranch);
    expect(source.slice(serverResponseBranch, fallbackBranch)).toContain("response.status === 503");
    expect(source.slice(serverResponseBranch, fallbackBranch)).toContain("Your original image is unchanged");
  });

  it("keeps fallback bounded and always clears the busy action", () => {
    expect(source).toContain('"Background removal could not start on this connection');
    expect(source).toContain('"Background removal took too long');
    expect(source).toContain("finally {\n      setImageAction(null);");
  });

  it("only replaces the selected image after output validation", () => {
    const validation = source.indexOf('await inspectProcessedImage(result, "remove-bg")');
    const replacement = source.indexOf("await replaceSelectedImage(result)", validation);
    expect(validation).toBeGreaterThan(-1);
    expect(replacement).toBeGreaterThan(validation);
  });
});
