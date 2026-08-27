import type { CompleteMockupView } from "./complete-mockup-matrix";
import {
  getSourceMatrixV3Entry,
  type SourceMatrixV3Colour,
  type SourceMatrixV3Entry,
} from "./source-matrix-v3";

/**
 * Long Sleeve-only corrective release. It retains the reviewed v3 geometry but
 * routes its browser derivative to a separately verified native PSD composite.
 * Hoodie remains exclusively on source-matrix-v3.
 */
export type SourceMatrixV4LongSleeveEntry = Omit<SourceMatrixV3Entry, "assetPath" | "editableMasterPath"> & {
  assetPath: string;
  editableMasterPath: string;
};

const COLOURS = ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"] as const;
const VIEWS = ["front", "back", "left-sleeve", "right-sleeve", "neck-label"] as const;

export function getSourceMatrixV4LongSleeveEntry(
  colour: string,
  face: CompleteMockupView,
): SourceMatrixV4LongSleeveEntry | undefined {
  if (!COLOURS.includes(colour as SourceMatrixV3Colour) || !VIEWS.includes(face as (typeof VIEWS)[number])) return undefined;
  const source = getSourceMatrixV3Entry("longsleeve", colour, face);
  if (!source) return undefined;
  return {
    ...source,
    assetPath: `/mockups/source-matrix-v4/longsleeve/${colour}/${face}.jpg`,
    // Provenance only; raw editable sources stay quarantined and never browser-served.
    editableMasterPath: `quarantine/source-matrix-v4/longsleeve/${colour}/${face}.psd`,
  };
}

export function validateSourceMatrixV4LongSleeve(): string[] {
  const errors: string[] = [];
  for (const colour of COLOURS) for (const face of VIEWS) {
    const entry = getSourceMatrixV4LongSleeveEntry(colour, face);
    if (!entry || !entry.assetPath.startsWith("/mockups/source-matrix-v4/longsleeve/")) {
      errors.push(`missing or unsafe v4 Long Sleeve entry: ${colour}:${face}`);
    }
  }
  return errors;
}
