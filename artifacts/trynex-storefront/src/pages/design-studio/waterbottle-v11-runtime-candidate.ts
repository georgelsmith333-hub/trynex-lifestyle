import {
  validateWaterBottleV11StagingRecord,
  VERIFIED_WATER_BOTTLE_V11_STAGING_RECORD,
  type WaterBottleFace,
} from "./waterbottle-v11-staging";

export const WATER_BOTTLE_V11_RUNTIME_CANDIDATE_VERSION = "waterbottle-v11-runtime-candidate" as const;

type WaterBottleV11RuntimeAsset = {
  face: WaterBottleFace;
  url: string;
  sha256: string;
  sourcePsdSha256: string;
  sourcePsbSha256: string;
  neutralArtworkOnly: true;
  fixedProductClaims: readonly string[];
};

const STAGING_SURFACE_BY_FACE = new Map(
  VERIFIED_WATER_BOTTLE_V11_STAGING_RECORD.surfaces.map((surface) => [surface.face, surface]),
);

function assetFor(face: WaterBottleFace, sha256: string): WaterBottleV11RuntimeAsset {
  const stagingSurface = STAGING_SURFACE_BY_FACE.get(face);
  if (!stagingSurface) throw new Error(`Missing verified Water Bottle v1.1 ${face} staging evidence.`);
  return {
    face,
    url: `/mockups/waterbottle-v11/white/${face}.png`,
    sha256,
    sourcePsdSha256: stagingSurface.sourcePsdSha256,
    sourcePsbSha256: stagingSurface.smartObjectPayloadSha256,
    neutralArtworkOnly: true,
    fixedProductClaims: [],
  };
}

export const WATER_BOTTLE_V11_RUNTIME_CANDIDATE = {
  version: WATER_BOTTLE_V11_RUNTIME_CANDIDATE_VERSION,
  purpose: "review-only-customer-route-candidate" as const,
  runtimeActivationAllowed: false as const,
  provenance: "user-authorized-internal-agent-report" as const,
  assets: {
    front: assetFor("front", "3f7b8f989d7f5472840d59733c1483770ae1b18b7e9602cf81e9a7dfb3d3a59c"),
    back: assetFor("back", "27e43fae999754e5d49601ff0057eb125907815c4a475c395f0ae45a2f89c59c"),
  },
} as const;

/**
 * Candidate-only validation. It intentionally cannot be used as an automatic
 * release activation path; the smart-v9 all-surface gate remains authoritative.
 */
export function validateWaterBottleV11RuntimeCandidate(): void {
  validateWaterBottleV11StagingRecord(VERIFIED_WATER_BOTTLE_V11_STAGING_RECORD);
  if (WATER_BOTTLE_V11_RUNTIME_CANDIDATE.runtimeActivationAllowed !== false) {
    throw new Error("Water Bottle v1.1 candidate cannot enable automatic runtime activation.");
  }
  for (const face of ["front", "back"] as const) {
    const asset = WATER_BOTTLE_V11_RUNTIME_CANDIDATE.assets[face];
    if (!/^\/mockups\/waterbottle-v11\/white\/(front|back)\.png$/.test(asset.url)) {
      throw new Error(`Water Bottle v1.1 ${face} URL is outside the reviewed candidate root.`);
    }
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || asset.neutralArtworkOnly !== true || asset.fixedProductClaims.length !== 0) {
      throw new Error(`Water Bottle v1.1 ${face} candidate must remain neutral and hash-pinned.`);
    }
  }
}

validateWaterBottleV11RuntimeCandidate();
