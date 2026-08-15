import { useEffect, useRef, useState } from "react";
import { Wand2, Loader2, Info, RefreshCw, Sparkles, X } from "lucide-react";
import { fitImageTransform } from "./autoFit";
import { useDesignStore } from "@/hooks/useDesignStore";

const PROMPT_PRESETS = [
  { label: "Minimal logo", prompt: "A clean premium minimalist emblem, bold geometric silhouette, centered composition, high contrast, transparent-friendly background" },
  { label: "Street graphic", prompt: "A premium streetwear graphic with expressive typography space, bold illustrated shapes, balanced centered composition, screen-print friendly" },
  { label: "Nature badge", prompt: "A refined botanical badge with leaves, mountain contours, and a subtle vintage texture, centered and suitable for apparel printing" },
  { label: "Bangladesh pride", prompt: "A premium contemporary Bangladesh-inspired graphic using abstract river lines and cultural motifs, elegant centered composition, print-ready" },
];

export function AIPanel() {
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("blurry, watermark, illegible text, cropped subject, duplicate elements");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{ prompt: string; negative: string } | null>(null);
  const progressTimer = useRef<number | null>(null);
  const addLayer = useDesignStore((s) => s.addLayer);
  const selectLayer = useDesignStore((s) => s.selectLayer);
  const setActiveTab = useDesignStore((s) => s.setActiveTab);
  const activeFace = useDesignStore((s) => s.activeFace);
  const printZone = useDesignStore((s) => s.selectedProduct.printZone);

  useEffect(() => () => {
    if (progressTimer.current) window.clearInterval(progressTimer.current);
  }, []);

  const stopProgress = () => {
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const handleGenerate = async (request = { prompt: prompt.trim(), negative: negative.trim() }) => {
    if (!request.prompt || generating) return;
    setPrompt(request.prompt);
    setNegative(request.negative);
    setLastRequest(request);
    setGenerating(true);
    setError(null);
    setProgress(8);
    stopProgress();

    const query = new URLSearchParams({
      width: "1024",
      height: "1024",
      nologo: "true",
      enhance: "true",
      negative: request.negative,
    });
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(request.prompt)}?${query.toString()}`;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timeout = window.setTimeout(() => {
        img.src = "";
        stopProgress();
        setGenerating(false);
        setError("Generation took too long. Try a shorter prompt or tap Retry.");
      }, 45_000);
      img.onload = () => {
        window.clearTimeout(timeout);
        stopProgress();
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 12);
        const naturalW = img.naturalWidth || 1024;
        const naturalH = img.naturalHeight || 1024;
        // Keep a local copy when the provider permits canvas readback. This
        // prevents the compositor from re-fetching a transient cross-origin URL
        // after the user has already received a successful AI result.
        let stableSrc = url;
        try {
          const snapshot = document.createElement("canvas");
          snapshot.width = naturalW;
          snapshot.height = naturalH;
          const snapshotCtx = snapshot.getContext("2d");
          snapshotCtx?.drawImage(img, 0, 0, naturalW, naturalH);
          stableSrc = snapshot.toDataURL("image/png");
        } catch {
          // Keep the provider URL as a fallback if the image is not readable.
        }
        addLayer({
          id,
          name: request.prompt.slice(0, 42),
          type: "image",
          src: stableSrc,
          naturalW,
          naturalH,
          visible: true,
          locked: false,
          transform: fitImageTransform(naturalW, naturalH, { w: printZone.w, h: printZone.h }, { padding: 0.88, maxScale: 4 }),
          face: activeFace,
        });
        selectLayer(id);
        setActiveTab("layers");
        setProgress(100);
        setGenerating(false);
      };
      img.onerror = () => {
        window.clearTimeout(timeout);
        stopProgress();
        setGenerating(false);
        setError("The image service could not generate this request. Try another preset or tap Retry.");
      };
      img.src = url;
      let p = 8;
      progressTimer.current = window.setInterval(() => {
        p = Math.min(92, p + 4);
        setProgress(p);
      }, 450);
    } catch {
      stopProgress();
      setGenerating(false);
      setError("Generation failed before the image could be added.");
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">AI Design Assistant</label>
        {prompt && <button type="button" onClick={() => { setPrompt(""); setError(null); }} className="text-[10px] font-bold text-gray-400 hover:text-gray-700 flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PROMPT_PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => setPrompt(preset.prompt)} className="px-2.5 py-1.5 rounded-full text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 hover:bg-purple-100 transition-colors">
            <Sparkles className="inline w-3 h-3 mr-1" />{preset.label}
          </button>
        ))}
      </div>
      <textarea
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value.slice(0, 600)); setError(null); }}
        placeholder="Describe a centered print-ready design..."
        className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200 focus:border-purple-400 outline-none"
        rows={4}
        maxLength={600}
        disabled={generating}
      />
      <div className="flex justify-between text-[10px] text-gray-400"><span>Describe subject, mood, color, and style.</span><span>{prompt.length}/600</span></div>
      <details className="group">
        <summary className="text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer list-none flex items-center gap-1 select-none">
          <span className="text-gray-300 group-open:rotate-90 transition-transform inline-block">▶</span> Negative prompt
        </summary>
        <input value={negative} onChange={(e) => setNegative(e.target.value.slice(0, 300))} placeholder="blurry, watermark, cropped" className="w-full mt-2 px-3 py-2 rounded-xl text-xs border border-gray-200 focus:border-purple-400 outline-none" disabled={generating} />
      </details>
      <p className="text-[10px] text-gray-400">The result is added as a normal editable image layer, auto-fitted to the active print zone, selected automatically, and opened in Layers.</p>
      {generating && (
        <div className="rounded-xl p-3 space-y-1.5 bg-purple-50 border border-purple-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-purple-700"><span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Creating print-ready art…</span><span className="text-[10px] font-black text-purple-400">{Math.round(progress)}%</span></div>
          <div className="h-1.5 rounded-full overflow-hidden bg-purple-200"><div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-600 to-purple-400" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {error && <div className="flex items-start gap-2 p-3 rounded-xl text-xs text-red-700 bg-red-50 border border-red-200"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span className="flex-1">{error}</span>{lastRequest && <button type="button" onClick={() => void handleGenerate(lastRequest)} className="font-black underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>}</div>}
      <button onClick={() => void handleGenerate()} disabled={generating || !prompt.trim()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white bg-gradient-to-r from-purple-600 to-purple-500 disabled:opacity-50"><Wand2 className="w-4 h-4" /> {generating ? "Generating…" : "Generate AI Image"}</button>
    </div>
  );
}


export default AIPanel;
