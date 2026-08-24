import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PNG_SIGNATURE = "89504e470d0a1a0a";
const EXPECTED_SURFACE_COUNT = 188;
const AUTHENTIC_WATER_BOTTLE_HASHES = {
  "waterbottle:white:front": "19591c0934d008da06316296e9fa1de3cc693d7db0fd39bbd82db917ea4d8fb9",
  "waterbottle:white:back": "f3214733ce0687ec4cb8f42d520e810de8aed6ebcdf2b2b7ff94251a2d39e68a",
};
const VALID_PROVENANCE = new Set(["authentic-preserved", "generated-master", "derived-color-from-generated-master"]);

const [candidateRootArg, outputPathArg] = process.argv.slice(2);
if (!candidateRootArg || !outputPathArg) {
  throw new Error("Usage: node scripts/prepare-smart-v9-release.mjs <candidate-root> <output-ts-path>");
}

const candidateRoot = path.resolve(candidateRootArg);
const outputPath = path.resolve(outputPathArg);
const manifestPath = path.join(candidateRoot, "candidate-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = [];

if (manifest.assetCount !== EXPECTED_SURFACE_COUNT || manifest.assets?.length !== EXPECTED_SURFACE_COUNT) {
  errors.push(`smart-v9 requires exactly ${EXPECTED_SURFACE_COUNT} manifest assets.`);
}

const assets = [];
const seenKeys = new Set();
for (const asset of manifest.assets ?? []) {
  const sourceKey = `${asset.family}:${asset.color}:${asset.view}`;
  if (seenKeys.has(sourceKey)) errors.push(`duplicate source key: ${sourceKey}`);
  seenKeys.add(sourceKey);

  if (asset.visualReviewStatus !== "accepted") errors.push(`visual review not accepted: ${sourceKey}`);
  if (!VALID_PROVENANCE.has(asset.provenance)) errors.push(`invalid provenance: ${sourceKey}`);
  if (!/^[a-f0-9]{64}$/.test(asset.sha256 ?? "")) errors.push(`invalid manifest hash: ${sourceKey}`);

  const assetPath = path.resolve(candidateRoot, asset.path ?? "");
  if (!assetPath.startsWith(`${candidateRoot}${path.sep}`)) {
    errors.push(`unsafe candidate path: ${sourceKey}`);
    continue;
  }

  try {
    const bytes = await readFile(assetPath);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== asset.sha256) errors.push(`hash mismatch: ${sourceKey}`);
    if (bytes.subarray(0, 8).toString("hex") !== PNG_SIGNATURE || bytes.length < 26) {
      errors.push(`invalid PNG: ${sourceKey}`);
    } else if (bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1024 || bytes[24] !== 8 || bytes[25] !== 6) {
      errors.push(`expected 1024px RGBA PNG: ${sourceKey}`);
    }
  } catch {
    errors.push(`missing candidate asset: ${sourceKey}`);
  }

  if (sourceKey.startsWith("waterbottle:")) {
    if (asset.provenance !== "authentic-preserved") errors.push(`Water Bottle provenance is not authentic: ${sourceKey}`);
    if (asset.sha256 !== AUTHENTIC_WATER_BOTTLE_HASHES[sourceKey]) errors.push(`Water Bottle hash mismatch: ${sourceKey}`);
  }

  assets.push({
    sourceKey,
    assetUrl: `/mockups/smart-v9/${asset.path}`,
    sha256: asset.sha256,
    status: "accepted",
    provenance: asset.provenance,
  });
}

if (errors.length) {
  console.error(JSON.stringify({ validForRuntimeManifest: false, errorCount: errors.length, errors }, null, 2));
  process.exit(1);
}

const generated = `import type { SmartV9CandidateRelease } from "./smart-v9-release";\n\n/** Generated only after source assets, hashes, technical checks, and visual review all pass. */\nexport const SMART_V9_CANDIDATE: SmartV9CandidateRelease = ${JSON.stringify({ version: "smart-v9", visualGatePassed: true, technicalGatePassed: true, assets }, null, 2)} as const;\n`;
await writeFile(outputPath, generated);
console.log(JSON.stringify({ validForRuntimeManifest: true, assetCount: assets.length, outputPath }, null, 2));
