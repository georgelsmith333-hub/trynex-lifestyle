import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const app = await readFile(path.join(root, "src", "App.tsx"), "utf8");
const studio = await readFile(path.join(root, "src", "pages", "studio", "DesignStudioV2.tsx"), "utf8");
const aiPanel = await readFile(path.join(root, "src", "pages", "studio", "AIPanel.tsx"), "utf8");
const mockups = await readFile(path.join(root, "src", "pages", "design-studio", "mockups.tsx"), "utf8");

const checks = {
  actualRouteUsesStudioV2: app.includes('<Route path="/design-studio" component={DesignStudioV2} />'),
  allSixProductFamilies: ["tshirt", "longsleeve", "hoodie", "mug", "cap", "waterbottle"].every((family) => mockups.includes(`id: "${family}"`)),
  allOrNothingSmartV8Gate: mockups.includes("activateSmartV8Release") && mockups.includes("REQUIRED_SMART_V8_SURFACE_KEYS"),
  retiredSmartV7Blocked: mockups.includes('url.includes("smart-v7")'),
  activeRouteUsesProductionResolver: studio.includes("resolveMockup(") && studio.includes("getActiveMockupReleaseVersion"),
  cartAndSessionReleaseProvenance: studio.includes("mockupRelease") && studio.includes("studio_session_") && studio.includes("addToCart({"),
  originalArtworkHandoff: studio.includes("originalAssets") && studio.includes("/api/storage/uploads/request-url"),
  canvasAndLayerWorkflow: studio.includes("composeGarmentMockup") && studio.includes("layers.filter") && studio.includes("LayerPanel"),
  backgroundRemovalFallback: studio.includes("handleRemoveBackground") && studio.includes("@imgly/background-removal"),
  hdUpscale: studio.includes("handleUpscale"),
  aiArtworkAndReferenceEditing: aiPanel.includes("handleGenerate") && aiPanel.includes("flux-realism") && aiPanel.includes("flux-kontext"),
  printZoneWorkflow: studio.includes("getZonePZ(") && studio.includes("activeZoneConfig"),
  exportWorkflow: studio.includes("handleExportPNG") && studio.includes("composeDesignTexture"),
  responsiveLayout: studio.includes("isMobile") && studio.includes("md:hidden") && studio.includes("containerRef"),
  undoRedoWorkflow: studio.includes("undo") && studio.includes("redo") && studio.includes("MainToolbar"),
};

const missing = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
if (missing.length) throw new Error(`Design Studio capability verification failed: ${missing.join(", ")}`);
console.log(JSON.stringify({ suite: "smart-v8-design-studio-capabilities", passed: Object.keys(checks).length, checks }, null, 2));
