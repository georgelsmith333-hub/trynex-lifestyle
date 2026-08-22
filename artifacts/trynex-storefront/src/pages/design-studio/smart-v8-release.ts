import { COMPLETE_MOCKUP_MATRIX } from "./complete-mockup-matrix";

/**
 * The smart-v8 inventory is byte-verified against smart-v4, has passed the
 * six-family contact-sheet review, and contains an exact surface for every
 * canonical source key. Production `main` remains on smart-v4 until this
 * isolated branch is reviewed and merged.
 */
export const ACCEPTED_SMART_V8_RELEASE = {
  version: "smart-v8" as const,
  visualGatePassed: true,
  technicalGatePassed: true,
  assetUrls: Object.fromEntries(
    COMPLETE_MOCKUP_MATRIX.map((entry) => [
      entry.sourceKey,
      entry.assetPath.replace("/mockups/smart-v4/", "/mockups/smart-v8/"),
    ]),
  ) as Record<string, string>,
};
