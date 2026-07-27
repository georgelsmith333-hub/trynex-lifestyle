import { useState } from "react";
import { Search, Image as ImageIcon } from "lucide-react";
import { useDesignStore } from "@/hooks/useDesignStore";
import { STICKERS } from "@/pages/design-studio/mockups";

export function ClipArtBrowser() {
  const [query, setQuery] = useState("");
  const addLayer = useDesignStore((s) => s.addLayer);
  const activeFace = useDesignStore((s) => s.activeFace);

  const filtered = STICKERS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stickers..."
          className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-gray-200 focus:border-orange-400 outline-none"
        />
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {filtered.map((s) => (
          <button
            key={s.id}
            title={s.name}
            onClick={() => {
              const img = new Image();
              img.onload = () => {
                addLayer({
                  id: Math.random().toString(36).slice(2, 10),
                  name: s.name,
                  type: "image",
                  src: s.dataUrl,
                  naturalW: img.naturalWidth || 100,
                  naturalH: img.naturalHeight || 100,
                  visible: true,
                  locked: false,
                  transform: { x: 0, y: 0, scale: 0.4, rotation: 0, opacity: 1 },
                  face: activeFace,
                });
              };
              img.src = s.dataUrl;
            }}
            className="aspect-square rounded-lg bg-white border border-gray-200 hover:border-orange-300 flex items-center justify-center p-1.5"
          >
            <img src={s.dataUrl} alt={s.name} className="w-full h-full object-contain pointer-events-none" />
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-6 text-[11px] text-gray-400">No stickers found.</div>
      )}
    </div>
  );
}
