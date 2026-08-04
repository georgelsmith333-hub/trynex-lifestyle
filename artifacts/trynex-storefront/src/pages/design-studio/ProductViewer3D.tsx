/* ═══════════════════════════════════════════════════════
   PRODUCT VIEWER 3D — realtime preview using R3F

   Every category uses the reviewed photographic mockup as the visual authority.
   PhotoMockupMesh keeps the exact product silhouette and face-specific photo in
   the 3D preview; the transparent design texture is the only overlay.
════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  composeLayers,
  type ComposerLayer,
  type ComposerPrintZone,
} from "./composer";
import { resolveMockup, type DesignProduct } from "./mockups";
import {
  PhotoMockupMesh,
  ResettableOrbitControls,
  ViewerLoadingOverlay,
  NoWebGLFallback,
  StudioLightRig,
  hasWebGL2,
  VIEWER_DEFAULTS,
  VIEWER_FRAMING,
  VIEWER_FRAMING_BACK,
} from "../../components/garment3d";

interface FacePayload {
  layers: ComposerLayer[];
  printZone: ComposerPrintZone;
  baseHeight: number;
}

export interface ProductViewer3DProps {
  product: DesignProduct;
  garmentColor: string;
  front: FacePayload;
  back?: FacePayload;
  activeFace?: "front" | "back";
  /** True when the mug is in "Full Wrap" mode — back layers fill the full 360° body. */
  isWrapMode?: boolean;
}

/* ── Face texture for any reviewed photographic product mockup ───────────── */
function useFaceTexture(
  face: FacePayload | undefined,
  garmentColor: string | null,
  opts: { outW: number; outH: number; clipToPrintZone?: boolean; curvature?: number }
): THREE.CanvasTexture | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [, setVersion] = useState(0);

  if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
  if (!textureRef.current) {
    const tex = new THREE.CanvasTexture(canvasRef.current);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    textureRef.current = tex;
  }

  const sig = face
    ? JSON.stringify({
        g: garmentColor,
        z: face.printZone,
        h: face.baseHeight,
        l: face.layers.map((l) =>
          l.type === "image"
            ? [
                l.visible, l.transform, l.naturalW, l.naturalH, l.src.slice(0, 64),
                l.flipH, l.flipV, l.brightness, l.contrast, l.saturation,
              ]
            : [
                l.visible, l.transform, l.text, l.fontFamily, l.fontSize,
                l.fontStyle, l.fontWeight, l.color,
                l.textAlign, l.letterSpacing, l.strokeColor, l.strokeWidth,
                l.shadowColor, l.shadowBlur, l.shadowOffsetX, l.shadowOffsetY,
              ]
        ),
      })
    : "";

  const faceRef = useRef(face);
  faceRef.current = face;
  const clipFlag = opts.clipToPrintZone ?? true;

  useEffect(() => {
    const f = faceRef.current;
    if (!f) return;
    let cancelled = false;
    composeLayers({
      canvas: canvasRef.current!,
      baseHeight: f.baseHeight,
      printZone: f.printZone,
      layers: f.layers,
      garmentColor,
      outW: opts.outW,
      outH: opts.outH,
      imageCache: cacheRef.current,
      clipToPrintZone: clipFlag,
      blendMode: "multiply",
      curvature: opts.curvature ?? 0,
    }).then(() => {
      if (cancelled) return;
      if (textureRef.current) textureRef.current.needsUpdate = true;
      setVersion((v) => v + 1);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, garmentColor, opts.outW, opts.outH, clipFlag]);

  return face ? textureRef.current : null;
}

/* ── Camera rig: smooth orbit to the active face ─────────────────────────── */
function CameraRig({
  activeFace,
  category,
}: {
  activeFace: "front" | "back";
  category: "tshirt" | "longsleeve" | "hoodie" | "cap" | "mug" | "waterbottle";
}) {
  const f = VIEWER_FRAMING[category];
  const b = VIEWER_FRAMING_BACK[category] || {};
  const hasBackFace =
    category === "tshirt" ||
    category === "longsleeve" ||
    category === "hoodie" ||
    category === "mug" ||
    category === "cap" ||
    category === "waterbottle";
  const isBack = hasBackFace && activeFace === "back";
  const targetY = isBack ? Math.PI : 0;
  const radius  = isBack && (b as any).radius   !== undefined ? (b as any).radius   : f.radius;
  const cameraY = isBack && (b as any).cameraY  !== undefined ? (b as any).cameraY  : f.cameraY;

  useFrame(({ camera }) => {
    const cur  = Math.atan2(camera.position.x, camera.position.z);
    const next = cur + (targetY - cur) * 0.06;
    camera.position.x = Math.sin(next) * radius;
    camera.position.z = Math.cos(next) * radius;
    camera.position.y = cameraY;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function ProductViewer3D({
  product,
  garmentColor,
  front,
  back,
  activeFace = "front",
}: ProductViewer3DProps) {
  const isMug         = product.category === "mug";
  const isWaterBottle = product.category === "waterbottle";

  /* ── Photo selection: pick the dark product photo for near-black colours ──
   * Products that have a dedicated dark/black photo (cap) switch to it when
   * garmentColor is near-black so the 3D scene uses the real black photo.
   * PhotoMockupMesh already uses transparent:true + alphaTest:0.01. */
  const frontMockup = resolveMockup(product, garmentColor, "front");
  const backMockup = resolveMockup(product, garmentColor, "back");
  // The billboard always uses the transparent derivative. Exact source-kit
  // colours arrive pre-rendered, while only curated transparent fallbacks tint.
  const resolvedFrontPhoto = frontMockup.cutoutSrc;
  const resolvedBackPhoto = backMockup.cutoutSrc;
  const frontPhotoTint = frontMockup.requiresTint ? garmentColor : undefined;
  const backPhotoTint = backMockup.requiresTint ? garmentColor : undefined;

  const isCap = product.category === "cap";
  const surfaceCurvature = isMug ? 0.16 : isWaterBottle ? 0.16 : isCap ? 0.1 : 0;

  /* ── Face textures for every photographic mockup ────────────────────────
   * Mug and bottle intentionally use the same path as garments. The previous
   * procedural MugBody/WaterBottleBody branches made the preview disagree
   * with the reviewed product photos used by the editor and order thumbnails. */
  const frontTex = useFaceTexture(
    front,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true, curvature: surfaceCurvature }
  );
  const backTex = useFaceTexture(
    back,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true, curvature: surfaceCurvature }
  );

  const supports3D = useMemo(() => hasWebGL2(), []);

  /* Fallback 2D composition for WebGL-less devices */
  const [fallbackUrl, setFallbackUrl] = useState<string | undefined>();
  useEffect(() => {
    if (supports3D || !front) return;
    const c = document.createElement("canvas");
    composeLayers({
      canvas: c,
      baseHeight: front.baseHeight,
      printZone: front.printZone,
      layers: front.layers,
      garmentColor: null,
      outW: 1024,
      outH: 1024,
      imageCache: new Map(),
      clipToPrintZone: true,
      blendMode: "source-over",
    }).then(() => setFallbackUrl(c.toDataURL("image/png")));
  }, [supports3D, front]);

  /* No WebGL2 → flat 2D photo mockup fallback. */
  if (!supports3D) {
    const fallbackGarmentSrc = frontMockup.photoKind === "opaque-photo"
      ? frontMockup.photoSrc
      : frontMockup.cutoutSrc;
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <NoWebGLFallback
          garmentSrc={fallbackGarmentSrc}
          designSrc={fallbackUrl}
          garmentColor={garmentColor}
          requiresTint={frontMockup.photoKind === "transparent-cutout" && frontMockup.requiresTint}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={VIEWER_DEFAULTS.dpr}
        camera={{ position: VIEWER_DEFAULTS.cameraPosition, fov: VIEWER_DEFAULTS.fov }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <StudioLightRig rim />
          <Environment preset="studio" />
          <CameraRig activeFace={activeFace} category={product.category as any} />

          {/* ── MUG — reviewed front/back photo mockup ─────────────────────
              Do not replace this with a procedural cylinder: the customer
              selected these exact product photos as the source of truth. */}
          {product.category === "mug" && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontPhoto}
              backPhotoSrc={resolvedBackPhoto}
              frontTex={frontTex}
              backTex={backTex}
              frontTint={frontPhotoTint}
              backTint={backPhotoTint}
              frontFrame={frontMockup.normalizedFrame}
              backFrame={backMockup.normalizedFrame}
              planeW={2.6}
              planeH={2.6}
              activeFace={activeFace}
            />
          )}

          {/* ── T-SHIRT ── */}
          {product.category === "tshirt" && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontPhoto}
              backPhotoSrc={resolvedBackPhoto}
              frontTex={frontTex}
              backTex={backTex}
              frontTint={frontPhotoTint}
              backTint={backPhotoTint}
              frontFrame={frontMockup.normalizedFrame}
              backFrame={backMockup.normalizedFrame}
              activeFace={activeFace}
            />
          )}

          {/* ── LONG SLEEVE ── */}
          {product.category === "longsleeve" && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontPhoto}
              backPhotoSrc={resolvedBackPhoto}
              frontTex={frontTex}
              backTex={backTex}
              frontTint={frontPhotoTint}
              backTint={backPhotoTint}
              frontFrame={frontMockup.normalizedFrame}
              backFrame={backMockup.normalizedFrame}
              activeFace={activeFace}
            />
          )}

          {/* ── HOODIE ── */}
          {product.category === "hoodie" && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontPhoto}
              backPhotoSrc={resolvedBackPhoto}
              frontTex={frontTex}
              backTex={backTex}
              frontTint={frontPhotoTint}
              backTint={backPhotoTint}
              frontFrame={frontMockup.normalizedFrame}
              backFrame={backMockup.normalizedFrame}
              activeFace={activeFace}
            />
          )}

          {/* ── CAP ── */}
          {product.category === "cap" && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontPhoto}
              backPhotoSrc={resolvedBackPhoto}
              frontTex={frontTex}
              backTex={backTex}
              frontTint={frontPhotoTint}
              backTint={backPhotoTint}
              frontFrame={frontMockup.normalizedFrame}
              backFrame={backMockup.normalizedFrame}
              activeFace={activeFace}
              planeW={2.2}
              planeH={2.2}
            />
          )}

          {/* ── WATER BOTTLE — reviewed front/back photo mockup ────────── */}
          {product.category === "waterbottle" && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontPhoto}
              backPhotoSrc={resolvedBackPhoto}
              frontTex={frontTex}
              backTex={backTex}
              frontTint={frontPhotoTint}
              backTint={backPhotoTint}
              frontFrame={frontMockup.normalizedFrame}
              backFrame={backMockup.normalizedFrame}
              planeW={3.6}
              planeH={3.6}
              activeFace={activeFace}
            />
          )}

          <ContactShadows
            position={[0, VIEWER_FRAMING[product.category as keyof typeof VIEWER_FRAMING].shadowY, 0]}
            opacity={isMug || product.category === "waterbottle" ? 0.22 : 0.45}
            blur={isMug || product.category === "waterbottle" ? 1.8 : 2.8}
            scale={isMug || product.category === "waterbottle" ? 4 : 8}
            far={isMug || product.category === "waterbottle" ? 2 : 6}
            color="#1a0a00"
          />

          <ResettableOrbitControls
            enablePan={false}
            enableZoom={true}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.7}
            zoomSpeed={0.8}
            minDistance={VIEWER_FRAMING[product.category as keyof typeof VIEWER_FRAMING].minDistance}
            maxDistance={VIEWER_FRAMING[product.category as keyof typeof VIEWER_FRAMING].maxDistance}
            minPolarAngle={isMug ? Math.PI * 0.32 : Math.PI * 0.25}
            maxPolarAngle={isMug ? Math.PI * 0.72 : Math.PI * 0.65}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
          />
        </Suspense>
      </Canvas>
      <ViewerLoadingOverlay />
    </div>
  );
}
