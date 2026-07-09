/* ═══════════════════════════════════════════════════════
   CART VIEWER 3D — compact interactive 3D garment preview
   Loads pre-composed design texture URLs (stored at cart time)
   so it never needs raw Layer objects — tiny bundle cost.
   Uses the shared garment3d helpers so rendering matches the studio exactly.
════════════════════════════════════════════════════════ */
import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import {
  PhotoMockupMesh,
  MugBody,
  WaterBottleBody,
  useUrlTexture,
  ResettableOrbitControls,
  ViewerLoadingOverlay,
  NoWebGLFallback,
  StudioLightRig,
  hasWebGL2,
  VIEWER_DEFAULTS,
  VIEWER_FRAMING,
  VIEWER_FRAMING_BACK,
} from "./garment3d";
import { isNearBlack, BASE_BY_CATEGORY } from "../pages/design-studio/mockups";

/**
 * Resolve the correct front + back product photos for CartViewer3D.
 *
 * Rules (mirrors ProductViewer3D logic so cart and studio look identical):
 *  • For near-black garment colours: use the dedicated dark cutout PNG when one
 *    exists (tshirt / hoodie / mug). For products without a dark asset
 *    (longsleeve, cap, waterbottle) stay on the white cutout — PhotoMockupMesh
 *    will multiply-tint it to the correct dark hue.
 *  • Back photos always use the transparent-background cutout variant so colour
 *    tinting doesn't spill onto a studio-background rectangle.
 *  • Longsleeve dark PNGs are intentionally excluded — they are grayscale stubs
 *    that look broken in 3D. The white cutout + tint path renders correctly.
 */
function resolveCartPhotos(
  category: GarmentCategory,
  garmentColor: string,
): { frontSrc: string; backSrc?: string } {
  const base = BASE_BY_CATEGORY[category as keyof typeof BASE_BY_CATEGORY];
  const nearBlack = isNearBlack(garmentColor);
  // Use dark photo only when a proper dark asset exists in BASE_BY_CATEGORY
  const hasDarkFront = nearBlack && !!base && !!(base.darkFront || base.darkFrontCutout);
  const hasDarkBack  = nearBlack && !!base && !!(base.darkBack  || base.darkBackCutout);

  const fronts: Record<GarmentCategory, string> = {
    tshirt:      hasDarkFront ? "/mockups/black-tshirt-front-cutout.png"      : "/mockups/white-tshirt-front-cutout.png",
    // longsleeve dark PNGs are grayscale stubs — always tint the white cutout
    longsleeve:  "/mockups/white-longsleeve-front-cutout-real.png",
    hoodie:      hasDarkFront ? "/mockups/black-hoodie-front-cutout-real.png" : "/mockups/white-hoodie-front-cutout-real.png",
    cap:         "/mockups/white-cap-front-cutout.png",
    mug:         hasDarkFront ? "/mockups/black-mug-front-cutout.png"          : "/mockups/white-mug-front-cutout.png",
    waterbottle: "/mockups/white-waterbottle-front-cutout.png",
  };

  // Back photos: always use the cutout version (transparent BG) so tinting
  // doesn't bleed onto a studio-background rectangle visible behind the garment.
  const backs: Partial<Record<GarmentCategory, string>> = {
    tshirt:     hasDarkBack ? "/mockups/black-tshirt-back-cutout.png"      : "/mockups/white-tshirt-back-cutout.png",
    longsleeve: "/mockups/white-longsleeve-back-cutout-real.png",
    hoodie:     hasDarkBack ? "/mockups/black-hoodie-back-cutout-real.png" : "/mockups/white-hoodie-back-cutout-real.png",
  };

  return { frontSrc: fronts[category], backSrc: backs[category] };
}

type GarmentCategory = "tshirt" | "longsleeve" | "hoodie" | "mug" | "cap" | "waterbottle";

/**
 * Unified camera controller for garments (non-mug):
 *   Phase 1 (ticks 0–80): brief auto-rotate intro so user sees the 3D shape
 *   Phase 2 (tick > 80):  smoothly lerp to the selected face and hold
 *
 * For mug: always auto-rotate (user never switches face).
 */
function CameraController({
  activeFace,
  category,
}: {
  activeFace: "front" | "back";
  category: GarmentCategory;
}) {
  const tickRef = useRef(0);
  const INTRO_TICKS = 80;
  const f = VIEWER_FRAMING[category];
  const b = VIEWER_FRAMING_BACK[category] || {};
  const noBackFace = category === "mug" || category === "cap" || category === "waterbottle";

  useFrame(({ camera }) => {
    tickRef.current++;
    const isBack = activeFace === "back" && !noBackFace;
    const radius = isBack && b.radius !== undefined ? b.radius : f.radius;
    const camY   = isBack && b.cameraY !== undefined ? b.cameraY : f.cameraY;

    if (noBackFace) {
      // Mug: keep auto-rotating indefinitely until user grabs OrbitControls
      const angle = -tickRef.current * 0.008;
      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = camY;
      camera.lookAt(0, 0, 0);
      return;
    }

    if (tickRef.current <= INTRO_TICKS) {
      // Garment intro: slow spin to show the 3D shape
      const angle = -tickRef.current * 0.010;
      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = camY;
      camera.lookAt(0, 0, 0);
    } else {
      // Garment face lock: lerp toward selected face
      const targetY = isBack ? Math.PI : 0;
      const cur  = Math.atan2(camera.position.x, camera.position.z);
      const next = cur + (targetY - cur) * 0.08;
      camera.position.x = Math.sin(next) * radius;
      camera.position.z = Math.cos(next) * radius;
      camera.position.y = camY;
      camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

/* ── Public component ──────────────────────────────── */
export interface CartViewer3DProps {
  garmentColor: string;
  /** product category — controls which 3D shape to render */
  category: GarmentCategory;
  /** Pre-composed design texture URL (transparent bg, design at correct UV position) */
  frontTexUrl?: string;
  /** Back-face design texture URL */
  backTexUrl?: string;
}

export default function CartViewer3D({
  garmentColor,
  category,
  frontTexUrl,
  backTexUrl,
}: CartViewer3DProps) {
  const isMug         = category === "mug";
  const isWaterBottle = category === "waterbottle";
  // Garments with front and back faces — toggle visible for all, even without back design
  const hasFrontBack = category === "tshirt" || category === "longsleeve" || category === "hoodie";
  const [face, setFace] = useState<"front" | "back">("front");

  const frontTex      = useUrlTexture(frontTexUrl);
  const backTex       = useUrlTexture(backTexUrl);
  // Mug / water bottle: design wrap texture (transparent bg)
  const mugTex        = useUrlTexture(isMug ? frontTexUrl : undefined);
  const bottleTex     = useUrlTexture(isWaterBottle ? frontTexUrl : undefined);

  // Resolve colour-aware product photos (dark cutout for near-black, white cutout otherwise).
  // Memoised by category + garmentColor so the THREE.TextureLoader only fires on colour change.
  const { frontSrc: resolvedFrontSrc, backSrc: resolvedBackSrc } = useMemo(
    () => resolveCartPhotos(category, garmentColor),
    [category, garmentColor],
  );

  // WebGL2 capability check — gracefully degrade to 2D mockup if unsupported
  const supports3D = useMemo(() => hasWebGL2(), []);
  if (!supports3D) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <NoWebGLFallback
          garmentSrc={resolvedFrontSrc}
          designSrc={frontTexUrl}
          garmentColor={garmentColor}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Front/Back toggle — shown for all garments with both faces */}
      {hasFrontBack && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,0.9)",
            padding: 3,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {(["front", "back"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFace(f)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: face === f ? "#E85D04" : "transparent",
                color: face === f ? "#fff" : "#475569",
              }}
            >
              {f === "front" ? "Front" : "Back"}
            </button>
          ))}
        </div>
      )}

      <Canvas
        shadows
        dpr={VIEWER_DEFAULTS.dpr}
        camera={{ position: VIEWER_DEFAULTS.cameraPosition, fov: VIEWER_DEFAULTS.fov }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <StudioLightRig rim />

          <Environment preset="city" />

          {/* Unified camera: auto-rotate intro → face lock (or continuous for mug) */}
          <CameraController activeFace={face} category={category} />

          {category === "mug" && (
            <MugBody wrapTex={mugTex} garmentColor={garmentColor} />
          )}
          {category === "waterbottle" && (
            <WaterBottleBody wrapTex={bottleTex} garmentColor={garmentColor} />
          )}
          {/* Garments — photo billboard (same approach as Design Studio).
              resolvedFrontSrc / resolvedBackSrc are colour-aware cutout PNGs:
              dark for near-black, white for everything else. PhotoMockupMesh
              multiplies garmentColor onto the white photo for mid-range hues. */}
          {(category === "tshirt" || category === "longsleeve" ||
            category === "hoodie" || category === "cap") && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontSrc}
              backPhotoSrc={resolvedBackSrc}
              frontTex={frontTex}
              backTex={backTex}
              garmentColor={garmentColor}
              activeFace={face}
            />
          )}

          <ContactShadows
            position={[0, VIEWER_FRAMING[category].shadowY, 0]}
            opacity={VIEWER_DEFAULTS.shadowOpacity}
            blur={VIEWER_DEFAULTS.shadowBlur}
            scale={VIEWER_DEFAULTS.shadowScale}
            far={VIEWER_DEFAULTS.shadowFar}
          />

          <ResettableOrbitControls
            enablePan={false}
            enableZoom={true}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.7}
            zoomSpeed={0.8}
            minDistance={VIEWER_FRAMING[category].minDistance}
            maxDistance={VIEWER_FRAMING[category].maxDistance}
            minPolarAngle={Math.PI * 0.25}
            maxPolarAngle={Math.PI * 0.65}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
          />
        </Suspense>
      </Canvas>
      <ViewerLoadingOverlay />
    </div>
  );
}
