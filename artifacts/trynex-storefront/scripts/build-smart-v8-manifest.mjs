import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(root, "public", "mockups", "smart-v4");
const targetRoot = path.join(root, "public", "mockups", "smart-v8");
const manifestPath = path.join(targetRoot, "release-manifest.json");

async function listPngs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listPngs(fullPath);
    return entry.isFile() && entry.name.endsWith(".png") ? [fullPath] : [];
  }));
  return nested.flat();
}

const sourceFiles = (await listPngs(sourceRoot)).sort();
if (sourceFiles.length !== 188) throw new Error(`Expected 188 smart-v4 source surfaces, found ${sourceFiles.length}.`);

const assets = [];
for (const sourcePath of sourceFiles) {
  const relative = path.relative(sourceRoot, sourcePath).split(path.sep).join("/");
  const [family, color, filename] = relative.split("/");
  const view = filename.replace(/\.png$/, "");
  const targetPath = path.join(targetRoot, relative);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  const bytes = await readFile(sourcePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Expected PNG source: ${relative}`);
  assets.push({
    sourceKey: `${family}:${color}:${view}`,
    family,
    color,
    view,
    sourcePath: `/mockups/smart-v4/${relative}`,
    assetPath: `/mockups/smart-v8/${relative}`,
    sha256,
    dimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
    provenance: "copied-byte-for-byte from smart-v4 validated source surface",
    visualAcceptance: "pending",
    technicalAcceptance: "pending",
    releaseStatus: "pending",
  });
}

await writeFile(manifestPath, JSON.stringify({ version: "smart-v8", sourceVersion: "smart-v4", generatedAt: new Date().toISOString(), assetCount: assets.length, assets }, null, 2) + "\n");
console.log(`Prepared ${assets.length} source-derived smart-v8 assets and manifest.`);
