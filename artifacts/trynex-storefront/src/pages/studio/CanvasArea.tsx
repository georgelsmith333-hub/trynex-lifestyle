import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { useDesignStore } from "@/hooks/useDesignStore";
import { DesignLayer } from "./DesignLayer";
import { Layer as LayerType } from "./types";

export function CanvasArea({ mockupImg }: { mockupImg?: HTMLImageElement }) {
  const trRef = useRef<Konva.Transformer>(null);
  const { layers, selectedIds, zoom, panX, panY, selectLayer, clearSelection } = useDesignStore();
  const [img, setImg] = useState<HTMLImageElement | null>(mockupImg ?? null);

  useEffect(() => {
    if (mockupImg) setImg(mockupImg);
  }, [mockupImg]);

  const selectedSet = new Set(selectedIds);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm" style={{ touchAction: "none" }}>
      <Stage
        width={600}
        height={600}
        scaleX={zoom}
        scaleY={zoom}
        x={panX}
        y={panY}
        onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
          if (e.target === e.target.getStage()) clearSelection();
        }}
        onTouchStart={(e: Konva.KonvaEventObject<TouchEvent>) => {
          if (e.target === e.target.getStage()) clearSelection();
        }}
      >
        <Layer>
          {img && <KonvaImage image={img} width={600} height={600} />}
        </Layer>
        <Layer>
          {layers.map((layer: LayerType) => (
            <DesignLayer
              key={layer.id}
              layer={layer}
              isSelected={selectedSet.has(layer.id)}
              onSelect={() => selectLayer(layer.id)}
            />
          ))}
          <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />
        </Layer>
      </Stage>
    </div>
  );
}
