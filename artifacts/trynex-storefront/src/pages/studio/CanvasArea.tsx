import { useRef } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { useDesignStore } from "@/hooks/useDesignStore";

export function CanvasArea({ mockupImg }: { mockupImg: HTMLImageElement }) {
  const trRef = useRef<Konva.Transformer>(null);
  const { zoom, panX, panY } = useDesignStore();

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm" style={{ touchAction: "none" }}>
      <Stage
        width={600}
        height={600}
        scaleX={zoom}
        scaleY={zoom}
        x={panX}
        y={panY}
      >
        <Layer>
          <KonvaImage image={mockupImg} width={600} height={600} />
        </Layer>
        <Layer>
          <Transformer ref={trRef} rotateEnabled flipEnabled />
        </Layer>
      </Stage>
    </div>
  );
}
