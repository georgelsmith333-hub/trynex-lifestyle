import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AIPanel.tsx", import.meta.url), "utf8");

describe("Design Studio AI terminal states", () => {
  it("bounds reference and generation requests", () => {
    expect(source).toContain("signal: AbortSignal.timeout(20_000)");
    expect(source).toContain("signal: AbortSignal.timeout(60_000)");
  });

  it("keeps outage messaging truthful and preserves the original artwork", () => {
    expect(source).toContain("Reference upload is temporarily unavailable");
    expect(source).toContain("Your original reference is unchanged");
    expect(source).toContain("The AI image service is temporarily unavailable");
    expect(source).toContain("No artwork was added");
    expect(source).toContain("The AI request timed out");
  });

  it("announces progress and errors accessibly", () => {
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain('role="alert" aria-live="assertive"');
  });

  it("does not add a generated layer until explicit approval", () => {
    const candidateStart = source.indexOf("const candidate = await prepareGeneratedImage");
    const approvalStart = source.indexOf("const approvePendingArtwork");
    expect(candidateStart).toBeGreaterThan(-1);
    expect(approvalStart).toBeGreaterThan(-1);
    expect(source.slice(candidateStart, approvalStart)).not.toContain("addLayer({");
    expect(source.slice(approvalStart)).toContain("addLayer({");
  });
});
