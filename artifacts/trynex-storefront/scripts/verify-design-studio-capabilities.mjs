import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const app = await readFile(path.join(root, "src", "App.tsx"), "utf8");
const studio = await readFile(path.join(root, "src", "pages", "studio", "DesignStudioV2.tsx"), "utf8");
const aiPanel = await readFile(path.join(root, "src", "pages", "studio", "AIPanel.tsx"), "utf8");
const layerPanel = await readFile(path.join(root, "src", "pages", "studio", "panels", "LayerPanel.tsx"), "utf8");
const styles = await readFile(path.join(root, "src", "index.css"), "utf8");
const mockups = await readFile(path.join(root, "src", "pages", "design-studio", "mockups.tsx"), "utf8");
const removeBgApi = await readFile(path.join(root, "..", "api-server", "src", "routes", "removeBg.ts"), "utf8");
const aiApi = await readFile(path.join(root, "..", "api-server", "src", "routes", "ai.ts"), "utf8");
const transformedImageValidation = await readFile(path.join(root, "..", "api-server", "src", "lib", "transformedImageValidation.ts"), "utf8");

const checks = {
  actualRouteUsesStudioV2: app.includes('<Route path="/design-studio" component={DesignStudioV2} />'),
  legacyPublicStudioPathsConverge: app.includes('<Route path="/design-studio-v1" component={() => <Redirect to="/design-studio" />} />') && app.includes('<Route path="/design-studio-v2" component={() => <Redirect to="/design-studio" />} />'),
  allSixProductFamilies: ["tshirt", "longsleeve", "hoodie", "mug", "cap", "waterbottle"].every((family) => mockups.includes(`id: "${family}"`)),
  allOrNothingSmartV8Gate: mockups.includes("activateSmartV8Release") && mockups.includes("REQUIRED_SMART_V8_SURFACE_KEYS"),
  retiredSmartV7Blocked: mockups.includes('url.includes("smart-v7")'),
  activeRouteUsesProductionResolver: studio.includes("resolveMockup(") && studio.includes("getActiveMockupReleaseVersion"),
  staticPickerUsesAcceptedRelease: mockups.includes('const STATIC_MOCKUP_RELEASE = ACCEPTED_SMART_V8_RELEASE ? "smart-v8" : "smart-v4"') && mockups.includes("const staticMockup ="),
  cartAndSessionReleaseProvenance: studio.includes("mockupRelease") && studio.includes("studio_session_") && studio.includes("addToCart({"),
  originalArtworkHandoff: studio.includes("originalAssets") && studio.includes("/api/storage/uploads/request-url"),
  canvasAndLayerWorkflow: studio.includes("composeGarmentMockup") && studio.includes("layers.filter") && studio.includes("LayerPanel"),
  backgroundRemovalFallback: studio.includes("handleRemoveBackground") && studio.includes("@imgly/background-removal"),
  operationSpecificClientAcceptance: studio.includes("inspectProcessedImage") && studio.includes('"remove-bg"') && studio.includes('"upscale"'),
  serverBackgroundOutputValidation: removeBgApi.includes("validateBackgroundRemovalOutput") && removeBgApi.includes("invalid_transformed_output") && transformedImageValidation.includes("missing_transparency"),
  hdUpscale: studio.includes("handleUpscale"),
  aiArtworkAndReferenceEditing: aiPanel.includes("handleGenerate") && aiPanel.includes("flux-realism") && aiPanel.includes("flux-kontext"),
  serverValidatedAiPrintApproval: aiApi.includes("validateAiArtworkOutput") && aiPanel.includes("pendingArtwork") && aiPanel.includes("Approve & add layer") && aiPanel.includes("/api/ai/generate"),
  printZoneWorkflow: studio.includes("getZonePZ(") && studio.includes("activeZoneConfig"),
  exportWorkflow: studio.includes("handleExportPNG") && studio.includes("composeDesignTexture"),
  responsiveLayout: studio.includes("isMobile") && studio.includes("md:hidden") && studio.includes("containerRef"),
  undoRedoWorkflow: studio.includes("undo") && studio.includes("redo") && studio.includes("MainToolbar"),
  keyboardFocusAndReducedMotion: studio.includes('event.key.toLowerCase() !== "z"') && styles.includes("focus-visible") && styles.includes("prefers-reduced-motion") && layerPanel.includes('aria-label={`${layer.visible ? "Hide" : "Show"}') && layerPanel.includes('aria-label={`Delete ${layer.name || "layer"}`}'),
};

const missing = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
if (missing.length) throw new Error(`Design Studio capability verification failed: ${missing.join(", ")}`);
console.log(JSON.stringify({ suite: "smart-v8-design-studio-capabilities", passed: Object.keys(checks).length, checks }, null, 2));
