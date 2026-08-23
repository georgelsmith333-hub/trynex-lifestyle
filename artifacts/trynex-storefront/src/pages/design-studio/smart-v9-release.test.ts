import { describe, expect, it } from "vitest";
import { COMPLETE_MOCKUP_MATRIX } from "./complete-mockup-matrix";
import { acceptSmartV9Release, type SmartV9CandidateRelease } from "./smart-v9-release";

function acceptedCandidate(): SmartV9CandidateRelease {
  return {
    version: "smart-v9",
    visualGatePassed: true,
    technicalGatePassed: true,
    assets: COMPLETE_MOCKUP_MATRIX.map((entry) => ({
      sourceKey: entry.sourceKey,
      assetUrl: entry.assetPath.replace("/mockups/smart-v4/", "/mockups/smart-v9/"),
      sha256: "a".repeat(64),
      status: "accepted" as const,
      provenance: entry.family === "waterbottle" ? "authentic-preserved" as const : "generated-master" as const,
    })),
  };
}

describe("smart-v9 release acceptance", () => {
  it("accepts an exactly complete, reviewed manifest", () => {
    expect(Object.keys(acceptSmartV9Release(acceptedCandidate()).assetUrls)).toHaveLength(188);
  });

  it("rejects any pending visual surface", () => {
    const candidate = acceptedCandidate();
    candidate.assets[0] = { ...candidate.assets[0], status: "pending" };
    expect(() => acceptSmartV9Release(candidate)).toThrow("not accepted");
  });

  it("rejects a generated Water Bottle substitute", () => {
    const candidate = acceptedCandidate();
    const bottle = candidate.assets.find((asset) => asset.sourceKey.startsWith("waterbottle:"));
    if (!bottle) throw new Error("fixture requires Water Bottle surface");
    bottle.provenance = "generated-master";
    expect(() => acceptSmartV9Release(candidate)).toThrow("authentic Water Bottle");
  });
});
