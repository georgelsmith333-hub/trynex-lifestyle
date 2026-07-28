/* ═══════════════════════════════════════════════════════
   CART VIEWER — 2D photo mockup with design overlay
   Pure CSS/img compositing. No Three.js/WebGL required.
   Shows garment photo tinted to the selected colour, with
   the design texture composited on top.
════════════════════════════════════════════════════════ */
import { useState, useMemo } from "react";
import { isLightTint, PRODUCTS, resolveMockup } from "../pages/design-studio/mockups";

type GarmentCategory = "tshirt" | "longsleeve" | "hoodie" | "mug" | "cap" | "waterbottle";

/**
 * Resolve the correct garment photo paths.
 * Near-black → dedicated dark cutout. Everything else → white cutout + tint.
 */
function resolvePhotos(
  category: GarmentCategory,
  garmentColor: string,
): {
  front: string;
  back?: string;
  frontIsColorPhoto: boolean;
  backIsColorPhoto: boolean;
} {
  const product = PRODUCTS.find((candidate) => candidate.category === category);
  if (!product) throw new Error(`No design product configured for category "${category}"`);
  const front = resolveMockup(product, garmentColor, "front");
  const back = resolveMockup(product, garmentColor, "back");
  return {
    front: front.isColorPhoto ? front.photoSrc : front.cutoutSrc,
    back: back.isColorPhoto ? back.photoSrc : back.cutoutSrc,
    frontIsColorPhoto: front.isColorPhoto,
    backIsColorPhoto: back.isColorPhoto,
  };
}

export interface CartViewer3DProps {
  garmentColor: string;
  category: GarmentCategory;
  /** Pre-composed design texture URL (transparent bg, design at correct position) */
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
  const hasFrontBack = category === "tshirt" || category === "longsleeve" || category === "hoodie";
  const [face, setFace] = useState<"front" | "back">("front");

  const { front: frontSrc, back: backSrc, frontIsColorPhoto, backIsColorPhoto } = useMemo(
    () => resolvePhotos(category, garmentColor),
    [category, garmentColor],
  );

  const garmentSrc  = face === "front" ? frontSrc : (backSrc ?? frontSrc);
  const designSrc   = face === "front" ? frontTexUrl : (backTexUrl ?? frontTexUrl);

  // Determine tinting strategy:
  //   nearBlack → use dark photo directly (no tint overlay needed) …
  //               EXCEPT for cap & waterbottle which have no dedicated dark-photo asset;
  //               for those we always tint so the selected colour is reflected.
  //   lightTint → white garment, no tint overlay needed
  //   else      → apply garmentColor via CSS multiply blend over white cutout
  const lightTint  = isLightTint(garmentColor);
  const exactPhoto = face === "front" ? frontIsColorPhoto : backIsColorPhoto;
  const needsTint  = !lightTint && !exactPhoto;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f3f0",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Front / Back toggle for apparel */}
      {hasFrontBack && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 10,
            display: "flex",
            gap: 3,
            background: "rgba(255,255,255,0.92)",
            padding: 3,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
          }}
        >
          {(["front", "back"] as const).map(f => (
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
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {f === "front" ? "Front" : "Back"}
            </button>
          ))}
        </div>
      )}

      {/* Mockup composite — garment photo + colour tint + design overlay */}
      <div
        style={{
          position: "relative",
          width: "88%",
          aspectRatio: "1 / 1",
          isolation: "isolate",
        }}
      >
        {/* Garment photo */}
        {garmentSrc && (
          <img
            src={garmentSrc}
            alt="Product"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        )}

        {/* Colour tint overlay (multiply blend) for coloured garments */}
        {needsTint && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: garmentColor,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Design overlay */}
        {designSrc && (
          <img
            src={designSrc}
            alt="Design"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
