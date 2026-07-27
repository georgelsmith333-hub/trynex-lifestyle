import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { useDesignStore, useSelectedLayer } from "@/hooks/useDesignStore";
import { DesignLayer } from "./DesignLayer";
import { Layer as LayerType, PrintZone } from "./types";

interface Props {
  width: number;
  height: number;
  /** Optional React node rendered behind the Konva stage as the mockup (e.g. GarmentSVG). */
  mockup?: React.ReactNode;
  /** Optional native image element to use as the mockup background inside Konva. */
  mockupImg?: HTMLImageElement;
  /** Print zone in the 1000×1000 coordinate space. CanvasArea maps it to the stage size. */
  printZone: PrintZone;
  /** Scale the design layer rendering so it aligns with the mockup print zone. */
  stageScale?: number;
}

export function CanvasArea({ width, height, mockup, mockupImg, printZone }: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const { layers, selectedIds, selectLayer, clearSelection } = useDesignStore();
  const selectedLayer = useSelectedLayer();
  const [img, setImg] = useState<HTMLImageElement | null>(mockupImg ?? null);

  useEffect(() => {
    if (mockupImg) setImg(mockupImg);
  }, [mockupImg]);

  // Map the 1000×1000 product viewBox to the stage width/height.
  const scale = width / 1000;
  const pz = {
    x: printZone.x * scale,
    y: printZone.y * scale,
    w: printZone.w * scale,
    h: printZone.h * scale,
  };
  const center = { x: pz.x + pz.w / 2, y: pz.y + pz.h / 2 };

  // Sync transformer with the selected layer(s).
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const stage = tr.getStage();
    if (!stage) return;
    if (selectedIds.length === 1) {
      const node = stage.findOne((node: Konva.Node) => node.getAttr("layerId") === selectedIds[0]);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
      }
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedIds, layers]);

  return (
    <div
      className="relative rounded-3xl overflow-hidden select-none"
      style={{
        width,
        height,
        background: "radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f8f8f8 55%, #f0f0f0 100%)",
        border: "1px solid #e5e5e7",
        boxShadow: "0 6px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
        isolation: "isolate",
      }}
    >
      {mockup}
      <Stage
        width={width}
        height={height}
        className="absolute inset-0"
        onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
          if (e.target === e.target.getStage()) clearSelection();
        }}
        onTouchStart={(e: Konva.KonvaEventObject<TouchEvent>) => {
          if (e.target === e.target.getStage()) clearSelection();
        }}
      >
        <Layer>
          {img && <KonvaImage image={img} width={width} height={height} listening={false} />}
        </Layer>
        <Layer>
          {layers.map((layer: LayerType) => (
            <DesignLayer
              key={layer.id}
              layer={layer}
              isSelected={selectedIds.includes(layer.id)}
              onSelect={() => selectLayer(layer.id)}
              stageScale={scale}
              printZoneCenter={center}
              printZoneSize={{ w: pz.w, h: pz.h }}
            />
          ))}
          <Transformer
            ref={trRef}
            rotateEnabled
            flipEnabled
            anchorSize={8}
            borderStroke="#E85D04"
            anchorStroke="#E85D04"
            anchorFill="#ffffff"
          />
        </Layer>
      </Stage>
    </div>
  );
}
