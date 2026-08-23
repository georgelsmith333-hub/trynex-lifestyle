import { describe, expect, it } from "vitest";
import { COMPLETE_MOCKUP_MATRIX } from "./complete-mockup-matrix";
import { acceptSmartV9Release, AUTHENTIC_WATER_BOTTLE_SHA256_BY_SOURCE_KEY, type SmartV9CandidateRelease } from "./smart-v9-release";

function acceptedCandidate(): SmartV9CandidateRelease {
  return {
    version: "smart-v9",
    visualGatePassed: true,
    technicalGatePassed: true,
    assets: COMPLETE_MOCKUP_MATRIX.map((entry) => ({
      sourceKey: entry.sourceKey,
      assetUrl: entry.assetPath.replace("/mockups/smart-v4/", "/mockups/smart-v9/"),
      sha256: entry.family === "waterbottle"
        ? AUTHENTIC_WATER_BOTTLE_SHA256_BY_SOURCE_KEY[entry.sourceKey]
        : "a".repeat(64),
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

  it("rejects a relabeled Water Bottle substitute with a different hash", () => {
    const candidate = acceptedCandidate();
    const bottle = candidate.assets.find((asset) => asset.sourceKey.startsWith("waterbottle:"));
    if (!bottle) throw new Error("fixture requires Water Bottle surface");
    bottle.sha256 = "b".repeat(64);
    expect(() => acceptSmartV9Release(candidate)).toThrow("does not match the authentic source");
  });

  it("rejects malformed release metadata and asset paths", () => {
    const wrongVersion = acceptedCandidate();
    wrongVersion.version = "smart-v8" as "smart-v9";
    expect(() => acceptSmartV9Release(wrongVersion)).toThrow("candidate version is invalid");

    const traversalPath = acceptedCandidate();
    traversalPath.assets[0] = { ...traversalPath.assets[0], assetUrl: "/mockups/smart-v9/../smart-v8/tshirt/white/front.png" };
    expect(() => acceptSmartV9Release(traversalPath)).toThrow("asset path is invalid");
  });
});
