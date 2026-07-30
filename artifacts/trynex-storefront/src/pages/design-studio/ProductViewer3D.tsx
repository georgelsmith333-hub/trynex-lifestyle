/* ═══════════════════════════════════════════════════════
   PRODUCT VIEWER 3D — realtime preview using R3F

   Mug wrap texture layout (2048×1024):
     [0 – 1024]    = Front/Left Side  (handle-facing ≈ right of left half)
     [1024 – 2048] = Back/Right Side  (handle-facing ≈ left of right half)

   MugBody UV mapping (existing garment3d.tsx behaviour):
     Single-side: frontOverlayGeo + repeat(0.5,1) + offset(0,0)
       → left 1024px of the 2048 canvas covers the front face ✓
     Wrap mode: bodyGeo + repeat(1,1) + offset(0.25,0)
       → u_geo=0 (+Z front) → u_tex=0.25 → canvas x=512 (centre left half) ✓
       → u_geo=0.5 (-Z back) → u_tex=0.75 → canvas x=1536 (centre right half) ✓

   Garments (tshirt/longsleeve/hoodie/cap): transparent 1024×1024 overlays.
   Water bottle: procedural cylinder with front overlay texture.
   Mug: real procedural MugBody cylinder — NOT a flat photo billboard.
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
  RealisticShirt,
  PhotoMockupMesh,
  MugBody,
  WaterBottleBody,
  adjustGarmentColor,
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

/* ── Generic face texture (garments: tshirt / longsleeve / hoodie / cap) ─── */
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

/* ── Combined mug wrap texture: 2048×1024 canvas ────────────────────────────
 * Front design → left 1024 px (u_tex = 0 … 0.5 with MugBody repeat 0.5)
 * Back  design → right 1024 px
 * curvature 0.16 fakes the cylindrical pinch so text/images read naturally.
 * ────────────────────────────────────────────────────────────────────────── */
function useMugWrapTexture(
  front: FacePayload | undefined,
  back:  FacePayload | undefined,
  curvature = 0.16,
): THREE.CanvasTexture | null {
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const cacheRef   = useRef<Map<string, HTMLImageElement>>(new Map());
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [, setVersion] = useState(0);

  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = 2048; c.height = 1024;
    canvasRef.current = c;
  }
  if (!textureRef.current) {
    const tex = new THREE.CanvasTexture(canvasRef.current);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.RepeatWrapping;
    textureRef.current = tex;
  }

  const sig = JSON.stringify({
    f: front ? {
      z: front.printZone, h: front.baseHeight,
      l: front.layers.map(l => l.type === "image"
        ? [l.visible, l.transform, l.naturalW, l.naturalH, l.src.slice(0, 64),
           l.flipH, l.flipV, l.brightness, l.contrast, l.saturation]
        : [l.visible, l.transform, l.text, l.fontFamily, l.fontSize,
           l.fontStyle, l.fontWeight, l.color, l.textAlign, l.letterSpacing,
           l.strokeColor, l.strokeWidth, l.shadowColor, l.shadowBlur,
           l.shadowOffsetX, l.shadowOffsetY]),
    } : null,
    b: back ? {
      z: back.printZone, h: back.baseHeight,
      l: back.layers.map(l => l.type === "image"
        ? [l.visible, l.transform, l.naturalW, l.naturalH, l.src.slice(0, 64),
           l.flipH, l.flipV, l.brightness, l.contrast, l.saturation]
        : [l.visible, l.transform, l.text, l.fontFamily, l.fontSize,
           l.fontStyle, l.fontWeight, l.color, l.textAlign, l.letterSpacing,
           l.strokeColor, l.strokeWidth, l.shadowColor, l.shadowBlur,
           l.shadowOffsetX, l.shadowOffsetY]),
    } : null,
    curvature,
  });

  const frontRef = useRef(front);
  frontRef.current = front;
  const backRef  = useRef(back);
  backRef.current = back;

  useEffect(() => {
    const f = frontRef.current;
    const b = backRef.current;
    if (!f && !b) return;

    let cancelled = false;
    const fCanvas = document.createElement("canvas");
    const bCanvas = document.createElement("canvas");
    const fHasLayers = f && f.layers.some(l => l.visible);
    const bHasLayers = b && b.layers.some(l => l.visible);
    const promises: Promise<unknown>[] = [];

    if (f && fHasLayers) {
      promises.push(
        composeLayers({
          canvas:          fCanvas,
          baseHeight:      f.baseHeight,
          printZone:       f.printZone,
          layers:          f.layers,
          garmentColor:    null,          // transparent — MugBody provides the colour
          outW: 1024, outH: 1024,
          imageCache:      cacheRef.current,
          clipToPrintZone: true,
          blendMode:       "source-over",
          curvature,
        })
      );
    }
    if (b && bHasLayers) {
      promises.push(
        composeLayers({
          canvas:          bCanvas,
          baseHeight:      b.baseHeight,
          printZone:       b.printZone,
          layers:          b.layers,
          garmentColor:    null,
          outW: 1024, outH: 1024,
          imageCache:      cacheRef.current,
          clipToPrintZone: true,
          blendMode:       "source-over",
          curvature,
        })
      );
    }

    Promise.all(promises).then(() => {
      if (cancelled) return;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 2048, 1024);
      if (fHasLayers) ctx.drawImage(fCanvas, 0,    0, 1024, 1024);
      if (bHasLayers) ctx.drawImage(bCanvas, 1024, 0, 1024, 1024);
      if (textureRef.current) textureRef.current.needsUpdate = true;
      setVersion(v => v + 1);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, curvature]);

  return (front || back) ? textureRef.current : null;
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
  const hasBackFace = category === "tshirt" || category === "longsleeve" || category === "hoodie" || category === "mug";
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
  isWrapMode = false,
}: ProductViewer3DProps) {
  const isMug         = product.category === "mug";
  const isWaterBottle = product.category === "waterbottle";
  const isGarment     = !isMug && !isWaterBottle;

  /* ── Photo selection: pick the dark product photo for near-black colours ──
   * Products that have a dedicated dark/black photo (cap) switch to it when
   * garmentColor is near-black so the 3D scene uses the real black photo.
   * PhotoMockupMesh already uses transparent:true + alphaTest:0.01. */
  const frontMockup = resolveMockup(product, garmentColor, "front");
  const backMockup = resolveMockup(product, garmentColor, "back");
  // Opaque studio photos must not be placed on a billboard. The reviewed
  // transparent cutout is the 3D source; it is tinted
  // only when that cutout is the white fallback rather than an exact dark one.
  const resolvedFrontPhoto = frontMockup.cutoutSrc;
  const resolvedBackPhoto = backMockup.cutoutSrc;
  const photoTint = frontMockup.cutoutNeedsTint ? garmentColor : undefined;

  const isCap = product.category === "cap";
  const capCurvature = isCap ? 0.1 : 0;

  /* ── Garment face textures (tshirt / longsleeve / hoodie / cap) ─── */
  const frontTex = useFaceTexture(
    isGarment ? front : undefined,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true, curvature: capCurvature }
  );
  const backTex = useFaceTexture(
    isGarment && back ? back : undefined,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true, curvature: capCurvature }
  );

  /* ── Water bottle face texture ─── */
  const bottleFrontTex = useFaceTexture(
    isWaterBottle ? front : undefined,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true, curvature: 0.16 }
  );

  /* ── Mug: combined 2048×1024 wrap texture (front on left, back on right) ─── */
  const mugWrapTex = useMugWrapTexture(
    isMug ? (isWrapMode || activeFace === "front" ? front : back) : undefined,
    isMug && isWrapMode && back ? back : undefined,
    0.16,
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
    const fallbackGarmentSrc = frontMockup.cutoutSrc;
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <NoWebGLFallback
          garmentSrc={fallbackGarmentSrc}
          designSrc={fallbackUrl}
          garmentColor={garmentColor}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        shadows
        dpr={VIEWER_DEFAULTS.dpr}
        camera={{ position: VIEWER_DEFAULTS.cameraPosition, fov: VIEWER_DEFAULTS.fov }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <StudioLightRig rim />
          <Environment preset="studio" />
          <CameraRig activeFace={activeFace} category={product.category as any} />

          {/* ── MUG — real procedural 3D cylinder (MugBody) with wrap texture ──
              Replaces the old flat PhotoMockupMesh billboard: the user now sees
              an actual cylindrical mug they can orbit, and the design curves
              naturally around the body via the 2048-wide wrap texture. */}
          {product.category === "mug" && (
            <MugBody
              wrapTex={mugWrapTex}
              garmentColor={adjustGarmentColor(garmentColor)}
              isWrapMode={isWrapMode}
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
              garmentColor={photoTint}
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
              garmentColor={photoTint}
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
              garmentColor={photoTint}
              activeFace={activeFace}
            />
          )}

          {/* ── CAP ── */}
          {product.category === "cap" && (
            <PhotoMockupMesh
              frontPhotoSrc={resolvedFrontPhoto}
              frontTex={frontTex}
              garmentColor={photoTint}
              activeFace={activeFace}
              planeW={2.2}
              planeH={2.2}
            />
          )}

          {/* ── WATER BOTTLE — procedural 3D cylinder ── */}
          {product.category === "waterbottle" && (
            <WaterBottleBody
              wrapTex={bottleFrontTex}
              garmentColor={adjustGarmentColor(garmentColor)}
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
