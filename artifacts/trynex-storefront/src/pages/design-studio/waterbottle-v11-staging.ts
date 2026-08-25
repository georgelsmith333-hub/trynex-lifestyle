export const WATER_BOTTLE_V11_STAGING_VERSION = "waterbottle-v11-staging" as const;

export type WaterBottleFace = "front" | "back";
export type WaterBottleV11MetadataStatus = "pending-native-smart-object-replacement" | "approved-native-smart-object";

export interface WaterBottleV11StagingSurface {
  face: WaterBottleFace;
  sourcePsdSha256: string;
  smartObjectPayloadSha256: string;
  neutralCompositeSha256: string;
  neutralArtworkOnly: true;
  fixedProductClaims: readonly string[];
  visuallyReviewed: boolean;
}

export interface WaterBottleV11StagingRecord {
  version: typeof WATER_BOTTLE_V11_STAGING_VERSION;
  purpose: "quarantine-staging-only";
  runtimeActivationAllowed: false;
  provenance: "user-authorized-internal-agent-report";
  bundleSha256: string;
  metadataStatus: WaterBottleV11MetadataStatus;
  surfaces: readonly WaterBottleV11StagingSurface[];
}

const SOURCE_BY_FACE = {
  front: {
    psd: "bbb40deb37a7536caf2eca99c648dfdccc88bd02528adbf1bcbe40765f8118e8",
    psb: "482cd068222f861d8f08699a86f8b0da8dc1be1c650983ab6a42246b8f2b6883",
    neutralComposite: "6d09867a21d30c97845d82849ea2adaded19997a98a34ae875000b7dd8aa5d55",
  },
  back: {
    psd: "8c8ab81a3dd3a0469d598a146984c57202158acbfcbc51c65df1616d8724dd3f",
    psb: "193aa64ac31cffb506a4bd796047c660e6d9efd4867c5945798af85f669b0e9f",
    neutralComposite: "dcc925cbda0db1c839a760085d71f9519f825dbc91db719348db12b0e9006ad2",
  },
} as const;

const V11_BUNDLE_SHA256 = "01e5c7b10d0fe9cb9ff4523908c605a9b42f0f7dc4ce2de9d961568448c3aed3";

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

/**
 * Validates staging evidence only. This function intentionally never returns a
 * runtime asset map: v1.1 source files remain outside browser delivery until a
 * separate customer-release contract is accepted.
 */
export function validateWaterBottleV11StagingRecord(record: WaterBottleV11StagingRecord): void {
  if (record.version !== WATER_BOTTLE_V11_STAGING_VERSION) {
    throw new Error("Water Bottle v1.1 staging version is invalid.");
  }
  if (record.purpose !== "quarantine-staging-only" || record.runtimeActivationAllowed !== false) {
    throw new Error("Water Bottle v1.1 evidence cannot enable runtime activation.");
  }
  if (record.provenance !== "user-authorized-internal-agent-report") {
    throw new Error("Water Bottle v1.1 provenance is not authorized for staging.");
  }
  if (record.bundleSha256 !== V11_BUNDLE_SHA256) {
    throw new Error("Water Bottle v1.1 bundle hash does not match the verified source package.");
  }
  if (record.metadataStatus !== "pending-native-smart-object-replacement" && record.metadataStatus !== "approved-native-smart-object") {
    throw new Error("Water Bottle v1.1 Smart Object metadata status is invalid.");
  }

  const supplied = new Map(record.surfaces.map((surface) => [surface.face, surface]));
  if (supplied.size !== 2 || record.surfaces.length !== 2) {
    throw new Error("Water Bottle v1.1 staging requires exactly one Front and one Back surface.");
  }

  for (const face of ["front", "back"] as const) {
    const surface = supplied.get(face);
    if (!surface) throw new Error(`Water Bottle v1.1 staging is missing ${face}.`);
    const expected = SOURCE_BY_FACE[face];
    if (surface.sourcePsdSha256 !== expected.psd || surface.smartObjectPayloadSha256 !== expected.psb) {
      throw new Error(`Water Bottle v1.1 ${face} source hashes do not match verified evidence.`);
    }
    if (!isSha256(surface.neutralCompositeSha256) || surface.neutralCompositeSha256 !== expected.neutralComposite) {
      throw new Error(`Water Bottle v1.1 ${face} neutral composite does not match reviewed evidence.`);
    }
    if (surface.neutralArtworkOnly !== true || surface.fixedProductClaims.length !== 0) {
      throw new Error(`Water Bottle v1.1 ${face} staging must not contain fixed product claims.`);
    }
    if (!surface.visuallyReviewed) {
      throw new Error(`Water Bottle v1.1 ${face} staging has not completed visual review.`);
    }
  }
}

export const VERIFIED_WATER_BOTTLE_V11_STAGING_RECORD: WaterBottleV11StagingRecord = {
  version: WATER_BOTTLE_V11_STAGING_VERSION,
  purpose: "quarantine-staging-only",
  runtimeActivationAllowed: false,
  provenance: "user-authorized-internal-agent-report",
  bundleSha256: V11_BUNDLE_SHA256,
  metadataStatus: "pending-native-smart-object-replacement",
  surfaces: [
    {
      face: "front",
      sourcePsdSha256: SOURCE_BY_FACE.front.psd,
      smartObjectPayloadSha256: SOURCE_BY_FACE.front.psb,
      neutralCompositeSha256: SOURCE_BY_FACE.front.neutralComposite,
      neutralArtworkOnly: true,
      fixedProductClaims: [],
      visuallyReviewed: true,
    },
    {
      face: "back",
      sourcePsdSha256: SOURCE_BY_FACE.back.psd,
      smartObjectPayloadSha256: SOURCE_BY_FACE.back.psb,
      neutralCompositeSha256: SOURCE_BY_FACE.back.neutralComposite,
      neutralArtworkOnly: true,
      fixedProductClaims: [],
      visuallyReviewed: true,
    },
  ],
};
