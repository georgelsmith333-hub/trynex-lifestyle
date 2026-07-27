import { useDesignStore, useSelectedLayer } from "@/hooks/useDesignStore";
import { Slider } from "@/components/ui/slider";
import { FlipHorizontal, FlipVertical, Sun, Contrast, Droplets } from "lucide-react";

export function ImagePanel() {
  const layer = useSelectedLayer();
  const updateLayer = useDesignStore((s) => s.updateLayer);

  if (!layer || layer.type !== "image") {
    return <div className="p-4 text-[11px] text-gray-400">Select an image layer to adjust.</div>;
  }

  const set = (key: keyof typeof layer, value: number) => updateLayer(layer.id, { [key]: value } as Partial<typeof layer>);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Brightness</span>
          <span>{layer.brightness ?? 100}%</span>
        </div>
        <Slider value={[layer.brightness ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("brightness", v)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Contrast className="w-3 h-3" /> Contrast</span>
          <span>{layer.contrast ?? 100}%</span>
        </div>
        <Slider value={[layer.contrast ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("contrast", v)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Droplets className="w-3 h-3" /> Saturation</span>
          <span>{layer.saturation ?? 100}%</span>
        </div>
        <Slider value={[layer.saturation ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("saturation", v)} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => updateLayer(layer.id, { flipH: !layer.flipH })} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${layer.flipH ? "bg-orange-50 border-orange-300 text-orange-600" : "bg-white border-gray-200"}`}><FlipHorizontal className="w-3.5 h-3.5 mx-auto" /></button>
        <button onClick={() => updateLayer(layer.id, { flipV: !layer.flipV })} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${layer.flipV ? "bg-orange-50 border-orange-300 text-orange-600" : "bg-white border-gray-200"}`}><FlipVertical className="w-3.5 h-3.5 mx-auto" /></button>
      </div>
    </div>
  );
}
