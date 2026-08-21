import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(process.cwd(), "artifacts/trynex-storefront/public/mockups/smart-v4");
const manifestPath = join(root, "manifest.json");
const colors = {
  tshirt: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
  longsleeve: ["white", "black", "navy", "maroon", "olive", "grey", "red", "sky-blue", "burgundy", "forest"],
  hoodie: ["white", "black", "navy", "grey", "maroon", "olive", "red", "sky-blue", "forest", "burgundy"],
  mug: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
  cap: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
  // White sublimation-coated aluminium blank; colored-body variants require
  // distinct physical masters and are intentionally not generated.
  waterbottle: ["white"],
};
const views = {
  tshirt: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  longsleeve: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  hoodie: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  mug: ["front", "back", "wrap"], cap: ["front", "back"], waterbottle: ["front", "back"],
};
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const byPath = new Map(manifest.assets.map((asset) => [asset.assetPath, asset]));
const errors = [];
let expected = 0;
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function pngInfo(buffer) {
  if (buffer.length < 26 || buffer.readUInt32BE(0) !== 0x89504e47 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorType: buffer[25] };
}
for (const [family, familyColors] of Object.entries(colors)) {
  for (const color of familyColors) for (const view of views[family]) {
    expected++;
    const rel = `/mockups/smart-v4/${family}/${color}/${view}.png`;
    const path = join(root, family, color, `${view}.png`);
    if (!existsSync(path)) { errors.push(`${rel}: missing`); continue; }
    const stat = statSync(path);
    const info = pngInfo(readFileSync(path));
    if (stat.size === 0) errors.push(`${rel}: zero-byte`);
    if (!info || info.width !== 1024 || info.height !== 1024 || info.colorType !== 6) errors.push(`${rel}: invalid PNG/RGBA/dimensions`);
    const asset = byPath.get(rel);
    if (!asset) errors.push(`${rel}: missing manifest row`);
    else if (asset.sha256 !== sha256(path)) errors.push(`${rel}: manifest hash mismatch`);
  }
}
if (manifest.assetCount !== expected || manifest.assets.length !== expected) errors.push(`manifest count ${manifest.assetCount}/${manifest.assets.length}; expected ${expected}`);
const sourceRoot = join(process.cwd(), "artifacts/trynex-storefront/src");
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]); }
for (const file of walk(sourceRoot).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))) {
  const text = readFileSync(file, "utf8");
  if (text.includes("/mockups/new/") || text.includes("source-kit-v3")) errors.push(`${relative(process.cwd(), file)}: stale mockup reference`);
}
if (errors.length) { console.error(JSON.stringify({ expected, errors }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ expected, manifestAssets: manifest.assets.length, status: "ok", root: relative(process.cwd(), root) }, null, 2));
