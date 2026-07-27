import { useDesignStore } from "@/hooks/useDesignStore";
import { PRODUCTS } from "@/pages/design-studio/mockups";
import { Package } from "lucide-react";

export function ProductSwitcher() {
  const selectedProduct = useDesignStore((s) => s.selectedProduct);
  const selectedColor = useDesignStore((s) => s.selectedColor);
  const setProduct = useDesignStore((s) => s.setProduct);
  const setColor = useDesignStore((s) => s.setColor);
  const setShowProductPicker = useDesignStore((s) => s.setShowProductPicker);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setShowProductPicker(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold hover:border-orange-300 transition-all"
      >
        <Package className="w-3.5 h-3.5 text-gray-400" />
        {selectedProduct.name}
      </button>
      <div className="flex items-center gap-1.5">
        {selectedProduct.colors.map((c: { hex: string; name: string }) => (
          <button
            key={c.hex}
            title={c.name}
            onClick={() => setColor(c)}
            className="w-6 h-6 rounded-full border border-gray-200 transition-transform hover:scale-110"
            style={{
              background: c.hex,
              boxShadow: selectedColor.hex === c.hex ? "0 0 0 2px #E85D04" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
