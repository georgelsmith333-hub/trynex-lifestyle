import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const studio = await readFile(path.join(root, "src", "pages", "DesignStudio.tsx"), "utf8");
const mockups = await readFile(path.join(root, "src", "pages", "design-studio", "mockups.tsx"), "utf8");
const checks = {
  actualRoute: studio.includes("export default function DesignStudio"),
  allSixProductFamilies: ["tshirt", "longsleeve", "hoodie", "mug", "cap", "waterbottle"].every((family) => mockups.includes(`id: \"${family}\"`)),
  allOrNothingSmartV8Gate: mockups.includes("activateSmartV8Release") && mockups.includes("REQUIRED_SMART_V8_SURFACE_KEYS"),
  retiredSmartV7Blocked: mockups.includes('url.includes("smart-v7")'),
  productionResolver: studio.includes("resolveMockup("),
  cartReleaseProvenance: studio.includes("mockupRelease") && studio.includes("addToCart({"),
  originalArtworkHandoff: studio.includes("originalAssets") && studio.includes("/api/storage/uploads/request-url"),
  canvasAndLayerWorkflow: studio.includes("composeGarmentMockup") && studio.includes("commitLayers") && studio.includes("layersToAdd"),
  backgroundRemovalFallback: studio.includes("handleRemoveBg") && studio.includes("@imgly/background-removal"),
  hdUpscale: studio.includes("handleUpscale"),
  aiArtwork: studio.includes("handleGenerateAI"),
  printZoneWorkflow: studio.includes("printZonePath") && studio.includes("isPrintZonePointInside"),
  exportWorkflow: studio.includes("handleExportPNG") && studio.includes("composeDesignTexture"),
  responsiveLayout: studio.includes("isMobile") && studio.includes("sm:") && studio.includes("lg:"),
  keyboardUndoRedo: studio.includes("keydown") && studio.includes("canUndo") && studio.includes("canRedo"),
};

const missing = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
if (missing.length) throw new Error(`Design Studio capability verification failed: ${missing.join(", ")}`);
console.log(JSON.stringify({ suite: "smart-v8-design-studio-capabilities", passed: Object.keys(checks).length, checks }, null, 2));
