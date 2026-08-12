import { useDesignStore } from "@/hooks/useDesignStore";
import { Package, ChevronRight } from "lucide-react";

export function ProductSwitcher() {
  const selectedProduct = useDesignStore((s) => s.selectedProduct);
  const setShowProductPicker = useDesignStore((s) => s.setShowProductPicker);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowProductPicker(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-black hover:border-orange-400 transition-all shadow-sm"
      >
        <Package className="w-3.5 h-3.5 text-orange-500" />
        <span className="text-gray-700">{selectedProduct.name}</span>
        <ChevronRight className="w-3 h-3 text-gray-400" />
      </button>
    </div>
  );
}
