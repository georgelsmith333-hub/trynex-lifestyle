import { Slider } from "@/components/ui/slider";
import { FlipHorizontal, FlipVertical, Sun, Contrast, Droplets, Eraser, Maximize2, Loader2 } from "lucide-react";
import { useDesignStore, useSelectedLayer } from "@/hooks/useDesignStore";

type ImageAction = "remove-bg" | "upscale" | null;

interface ImagePanelProps {
  onRemoveBackground?: () => void;
  onUpscale?: () => void;
  busyAction?: ImageAction;
}

export function ImagePanel({ onRemoveBackground, onUpscale, busyAction = null }: ImagePanelProps) {
  const layer = useSelectedLayer();
  const updateLayer = useDesignStore((s) => s.updateLayer);

  if (!layer || layer.type !== "image") {
    return <div className="p-4 text-[11px] text-gray-400">Select an image layer to adjust.</div>;
  }

  const set = (key: keyof typeof layer, value: number) => updateLayer(layer.id, { [key]: value } as Partial<typeof layer>);
  const busy = busyAction !== null;

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Quick image tools</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRemoveBackground}
            disabled={busy || !onRemoveBackground}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {busyAction === "remove-bg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            {busyAction === "remove-bg" ? "Removing…" : "Remove background"}
          </button>
          <button
            type="button"
            onClick={onUpscale}
            disabled={busy || !onUpscale}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-2 py-2 text-[10px] font-black text-violet-700 transition hover:bg-violet-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {busyAction === "upscale" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Maximize2 className="h-4 w-4" />}
            {busyAction === "upscale" ? "Preparing…" : "HD upscale"}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-gray-400">These actions replace the selected layer and remain visible on the product preview and export.</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Sun className="h-3 w-3" /> Brightness</span>
          <span>{layer.brightness ?? 100}%</span>
        </div>
        <Slider value={[layer.brightness ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("brightness", v)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Contrast className="h-3 w-3" /> Contrast</span>
          <span>{layer.contrast ?? 100}%</span>
        </div>
        <Slider value={[layer.contrast ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("contrast", v)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> Saturation</span>
          <span>{layer.saturation ?? 100}%</span>
        </div>
        <Slider value={[layer.saturation ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("saturation", v)} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => updateLayer(layer.id, { flipH: !layer.flipH })} aria-label="Flip horizontally" className={`flex-1 rounded-lg border py-2 text-xs font-bold ${layer.flipH ? "border-orange-300 bg-orange-50 text-orange-600" : "border-gray-200 bg-white"}`}><FlipHorizontal className="mx-auto h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => updateLayer(layer.id, { flipV: !layer.flipV })} aria-label="Flip vertically" className={`flex-1 rounded-lg border py-2 text-xs font-bold ${layer.flipV ? "border-orange-300 bg-orange-50 text-orange-600" : "border-gray-200 bg-white"}`}><FlipVertical className="mx-auto h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
