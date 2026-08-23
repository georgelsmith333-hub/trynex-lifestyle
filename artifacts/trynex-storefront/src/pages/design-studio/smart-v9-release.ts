import { COMPLETE_MOCKUP_MATRIX } from "./complete-mockup-matrix";

export type SmartV9SurfaceStatus = "accepted" | "pending" | "rejected";
export type SmartV9Provenance = "authentic-preserved" | "generated-master" | "derived-color-from-generated-master";

export interface SmartV9Surface {
  sourceKey: string;
  assetUrl: string;
  sha256: string;
  status: SmartV9SurfaceStatus;
  provenance: SmartV9Provenance;
}

export interface SmartV9CandidateRelease {
  version: "smart-v9";
  visualGatePassed: boolean;
  technicalGatePassed: boolean;
  assets: readonly SmartV9Surface[];
}

export interface AcceptedSmartV9Release {
  version: "smart-v9";
  assetUrls: Record<string, string>;
}

/** Exact hashes of the user-approved, source-preserved Water Bottle surfaces. */
export const AUTHENTIC_WATER_BOTTLE_SHA256_BY_SOURCE_KEY: Readonly<Record<string, string>> = {
  "waterbottle:white:front": "19591c0934d008da06316296e9fa1de3cc693d7db0fd39bbd82db917ea4d8fb9",
  "waterbottle:white:back": "f3214733ce0687ec4cb8f42d520e810de8aed6ebcdf2b2b7ff94251a2d39e68a",
};

const VALID_PROVENANCE: readonly SmartV9Provenance[] = [
  "authentic-preserved",
  "generated-master",
  "derived-color-from-generated-master",
];

/**
 * Converts a candidate manifest into a browser-safe asset map only when every
 * canonical surface is technically and visually accepted. This is deliberately
 * stricter than the hash validator: a generated or derived asset must also be
 * explicitly accepted, and the Water Bottle must retain its verified source.
 */
export function acceptSmartV9Release(candidate: SmartV9CandidateRelease): AcceptedSmartV9Release {
  if (candidate.version !== "smart-v9") {
    throw new Error("smart-v9 candidate version is invalid.");
  }
  if (!candidate.visualGatePassed || !candidate.technicalGatePassed) {
    throw new Error("smart-v9 cannot activate before visual and technical acceptance.");
  }
  const expectedKeys = COMPLETE_MOCKUP_MATRIX.map((entry) => entry.sourceKey);
  const supplied = new Map(candidate.assets.map((asset) => [asset.sourceKey, asset]));
  if (supplied.size !== expectedKeys.length || candidate.assets.length !== expectedKeys.length) {
    throw new Error(`smart-v9 requires exactly ${expectedKeys.length} unique accepted surfaces.`);
  }

  const assetUrls: Record<string, string> = {};
  for (const key of expectedKeys) {
    const asset = supplied.get(key);
    if (!asset) throw new Error(`smart-v9 asset is missing for ${key}.`);
    if (asset.status !== "accepted") throw new Error(`smart-v9 asset is not accepted for ${key}.`);
    if (!/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error(`smart-v9 asset hash is invalid for ${key}.`);
    if (!asset.assetUrl.startsWith("/mockups/smart-v9/") || !asset.assetUrl.endsWith(".png") || asset.assetUrl.includes("..") || asset.assetUrl.includes("?") || asset.assetUrl.includes("smart-v7")) {
      throw new Error(`smart-v9 asset path is invalid for ${key}.`);
    }
    if (!VALID_PROVENANCE.includes(asset.provenance)) {
      throw new Error(`smart-v9 asset provenance is invalid for ${key}.`);
    }
    if (key.startsWith("waterbottle:") && asset.provenance !== "authentic-preserved") {
      throw new Error(`smart-v9 must preserve the authentic Water Bottle source for ${key}.`);
    }
    if (key.startsWith("waterbottle:") && asset.sha256 !== AUTHENTIC_WATER_BOTTLE_SHA256_BY_SOURCE_KEY[key]) {
      throw new Error(`smart-v9 Water Bottle hash does not match the authentic source for ${key}.`);
    }
    assetUrls[key] = asset.assetUrl;
  }
  return { version: "smart-v9", assetUrls };
}
