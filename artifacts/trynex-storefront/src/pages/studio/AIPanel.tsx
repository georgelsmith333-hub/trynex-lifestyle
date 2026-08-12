import { useState } from "react";
import { Wand2, Loader2, Info } from "lucide-react";
import { fitImageTransform } from "./autoFit";
import { useDesignStore } from "@/hooks/useDesignStore";

export function AIPanel() {
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const addLayer = useDesignStore((s) => s.addLayer);
  const selectLayer = useDesignStore((s) => s.selectLayer);
  const setActiveTab = useDesignStore((s) => s.setActiveTab);
  const activeFace = useDesignStore((s) => s.activeFace);
  const printZone = useDesignStore((s) => s.selectedProduct.printZone);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setProgress(0);
    const fullPrompt = prompt.trim();
    const neg = encodeURIComponent(negative);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&nologo=true&enhance=true&negative=${neg}`;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const id = Math.random().toString(36).slice(2, 10);
        addLayer({
          id,
          name: prompt.slice(0, 30),
          type: "image",
          src: url,
          naturalW: img.naturalWidth || 1024,
          naturalH: img.naturalHeight || 1024,
          visible: true,
          locked: false,
          transform: fitImageTransform(img.naturalWidth || 1024, img.naturalHeight || 1024, { w: printZone.w, h: printZone.h }, { padding: 0.88, maxScale: 4 }),
          face: activeFace,
        });
        selectLayer(id);
        setActiveTab("layers");
        setGenerating(false);
        setProgress(100);
      };
      img.onerror = () => {
        setError("Failed to generate image. Try a different prompt.");
        setGenerating(false);
      };
      img.src = url;
      // Fake progress animation
      let p = 0;
      const interval = setInterval(() => {
        p += 5;
        setProgress(p);
        if (p >= 90) clearInterval(interval);
      }, 400);
    } catch (e) {
      setError("Generation failed.");
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">AI Prompt</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the image you want..."
        className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200 focus:border-purple-400 outline-none"
        rows={3}
      />
      <p className="text-[10px] text-gray-400">Create one original image from your prompt. It will be fitted to the active print zone automatically.</p>
      <details className="group">
        <summary className="text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer list-none flex items-center gap-1 select-none">
          <span className="text-gray-300 group-open:rotate-90 transition-transform inline-block">▶</span> Advanced
        </summary>
        <input
          value={negative}
          onChange={(e) => setNegative(e.target.value)}
          placeholder='e.g. "blurry, text, watermark"'
          className="w-full mt-2 px-3 py-2 rounded-xl text-xs border border-gray-200 focus:border-purple-400 outline-none"
        />
      </details>
      {generating && (
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f5f3ff", border: "1px solid #ede9fe" }}>
          <div className="flex items-center justify-between text-[11px] font-bold text-purple-700">
            <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Generating…</span>
            <span className="text-[10px] font-black text-purple-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-purple-200">
            <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-purple-600 to-purple-400" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl text-xs text-red-700 bg-red-50 border border-red-200">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white bg-gradient-to-r from-purple-600 to-purple-500 disabled:opacity-50"
      >
        <Wand2 className="w-4 h-4" /> Generate AI Image
      </button>
    </div>
  );
}
