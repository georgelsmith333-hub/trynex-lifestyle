import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(root, "public", "mockups", "smart-v8", "release-manifest.json"), "utf8"));
if (manifest.version !== "smart-v8" || manifest.assetCount !== 188 || manifest.assets.length !== 188) throw new Error("smart-v8 manifest is not complete.");

for (const asset of manifest.assets) {
  if (asset.sourcePath.includes("smart-v7") || asset.assetPath.includes("smart-v7")) throw new Error(`Retired asset reference: ${asset.sourceKey}`);
  if (!asset.dimensions || asset.dimensions.width !== 1024 || asset.dimensions.height !== 1024) throw new Error(`Unexpected normalized dimensions for ${asset.sourceKey}`);
  if (!["pending", "accepted", "active"].includes(asset.releaseStatus)) throw new Error(`Invalid release status for ${asset.sourceKey}`);
  const sourcePath = path.join(root, "public", asset.sourcePath.replace(/^\//, ""));
  const targetPath = path.join(root, "public", asset.assetPath.replace(/^\//, ""));
  const [sourceBytes, targetBytes, targetStat] = await Promise.all([readFile(sourcePath), readFile(targetPath), stat(targetPath)]);
  const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
  const targetHash = createHash("sha256").update(targetBytes).digest("hex");
  if (!targetStat.isFile() || sourceHash !== asset.sha256 || targetHash !== asset.sha256) throw new Error(`Hash or file validation failed for ${asset.sourceKey}`);
}

const activeAssets = manifest.assets.filter((asset) => asset.releaseStatus === "active").length;
console.log(JSON.stringify({ version: manifest.version, sourceVersion: manifest.sourceVersion, assetCount: manifest.assetCount, activeAssets, technicalGate: "passed", visualGate: manifest.visualGatePassed ? "passed" : "pending", activation: manifest.visualGatePassed && manifest.technicalGatePassed && activeAssets === 188 ? "accepted" : "blocked-pending-acceptance" }));
