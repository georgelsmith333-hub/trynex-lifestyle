import { useDesignStore } from "@/hooks/useDesignStore";
import { Undo2, Redo2, ZoomIn, ZoomOut, RotateCw, Move, Ruler, Download, Type, Image as ImageIcon, Shapes, MousePointer2 } from "lucide-react";
import { ToolType } from "../types";

const TOOLS: { id: ToolType; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", icon: <MousePointer2 className="w-4 h-4" /> },
  { id: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
  { id: "shape", label: "Shape", icon: <Shapes className="w-4 h-4" /> },
  { id: "draw", label: "Draw", icon: <Move className="w-4 h-4" /> },
  { id: "eyedrop", label: "Eyedropper", icon: <Move className="w-4 h-4" /> },
];

export function MainToolbar() {
  const activeTool = useDesignStore((s) => s.activeTool);
  const setActiveTool = useDesignStore((s) => s.setActiveTool);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const zoom = useDesignStore((s) => s.zoom);
  const setZoom = useDesignStore((s) => s.setZoom);
  const resetView = useDesignStore((s) => s.resetView);
  const showPrintZone = useDesignStore((s) => s.showPrintZone);
  const setShowPrintZone = useDesignStore((s) => s.setShowPrintZone);

  return (
    <div className="flex items-center gap-2 p-2 rounded-2xl bg-white border border-gray-200 shadow-sm flex-wrap">
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
              activeTool === t.id ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <div className="flex items-center gap-1">
        <button onClick={undo} className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600"><Undo2 className="w-3.5 h-3.5" /></button>
        <button onClick={redo} className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600"><Redo2 className="w-3.5 h-3.5" /></button>
      </div>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <div className="flex items-center gap-1">
        <button onClick={() => setZoom(zoom + 0.25)} className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600"><ZoomIn className="w-3.5 h-3.5" /></button>
        <button onClick={() => setZoom(zoom - 0.25)} className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button onClick={resetView} className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600"><RotateCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <button
        onClick={() => setShowPrintZone(!showPrintZone)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all ${showPrintZone ? "bg-orange-50 text-orange-600 border border-orange-200" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
      >
        <Ruler className="w-3.5 h-3.5" /> Print zone
      </button>
      <button className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-gray-900 text-white hover:bg-gray-800">
        <Download className="w-3.5 h-3.5" /> Export
      </button>
    </div>
  );
}
