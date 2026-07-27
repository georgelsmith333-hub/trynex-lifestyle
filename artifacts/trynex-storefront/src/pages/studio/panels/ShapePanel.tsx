import { useDesignStore, useSelectedLayer } from "@/hooks/useDesignStore";
import { Square, Circle, Star, Triangle, Hexagon } from "lucide-react";
import { ShapeType } from "../types";

const SHAPE_OPTIONS: { type: ShapeType; icon: React.ReactNode }[] = [
  { type: "rect", icon: <Square className="w-4 h-4" /> },
  { type: "circle", icon: <Circle className="w-4 h-4" /> },
  { type: "star", icon: <Star className="w-4 h-4" /> },
  { type: "arrow", icon: <Triangle className="w-4 h-4" /> },
  { type: "polygon", icon: <Hexagon className="w-4 h-4" /> },
];

export function ShapePanel() {
  const layer = useSelectedLayer();
  const updateLayer = useDesignStore((s) => s.updateLayer);
  const addLayer = useDesignStore((s) => s.addLayer);
  const activeFace = useDesignStore((s) => s.activeFace);

  if (!layer || layer.type !== "shape") {
    return (
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-gray-500">Click a shape to add it to the canvas.</p>
        <div className="grid grid-cols-5 gap-2">
          {SHAPE_OPTIONS.map((s) => (
            <button
              key={s.type}
              onClick={() => {
                const id = Math.random().toString(36).slice(2, 10);
                addLayer({
                  id,
                  name: s.type,
                  type: "shape",
                  shapeType: s.type,
                  fill: "#E85D04",
                  strokeColor: "#111111",
                  strokeWidth: 0,
                  width: 120,
                  height: 120,
                  sides: s.type === "polygon" ? 6 : undefined,
                  visible: true,
                  locked: false,
                  transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                  face: activeFace,
                });
              }}
              className="aspect-square rounded-xl bg-white border border-gray-200 hover:border-orange-300 flex items-center justify-center"
            >
              {s.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-bold text-gray-500">Fill</label>
        <input
          type="color"
          value={typeof layer.fill === "string" ? layer.fill : "#E85D04"}
          onChange={(e) => updateLayer(layer.id, { fill: e.target.value })}
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-bold text-gray-500">Stroke</label>
        <input
          type="color"
          value={layer.strokeColor || "#111111"}
          onChange={(e) => updateLayer(layer.id, { strokeColor: e.target.value })}
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
        />
        <input
          type="number"
          value={layer.strokeWidth}
          onChange={(e) => updateLayer(layer.id, { strokeWidth: parseInt(e.target.value, 10) || 0 })}
          className="w-16 px-2 py-1 rounded-lg text-xs border border-gray-200"
        />
      </div>
    </div>
  );
}
