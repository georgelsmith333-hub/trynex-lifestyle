import { useMemo } from "react";
import { Check, ChevronRight, Package, Search, Sparkles, X } from "lucide-react";
import { PRODUCTS, type DesignProduct } from "@/pages/design-studio/mockups";
import { useDesignStore } from "@/hooks/useDesignStore";

const CATEGORY_LABELS: Array<{ id: "all" | DesignProduct["category"]; label: string }> = [
  { id: "all", label: "All" },
  { id: "tshirt", label: "T-Shirts" },
  { id: "longsleeve", label: "Long Sleeves" },
  { id: "hoodie", label: "Hoodies" },
  { id: "mug", label: "Mugs" },
  { id: "cap", label: "Caps" },
  { id: "waterbottle", label: "Water Bottles" },
];

export function ProductSwitcher() {
  const selectedProduct = useDesignStore((s) => s.selectedProduct);
  const showProductPicker = useDesignStore((s) => s.showProductPicker);
  const productSearch = useDesignStore((s) => s.productSearch);
  const productPickerCategory = useDesignStore((s) => s.productPickerCategory);
  const setProduct = useDesignStore((s) => s.setProduct);
  const setLinkedStoreProduct = useDesignStore((s) => s.setLinkedStoreProduct);
  const setQuantity = useDesignStore((s) => s.setQuantity);
  const setFace = useDesignStore((s) => s.setFace);
  const setMugMode = useDesignStore((s) => s.setMugMode);
  const setShowProductPicker = useDesignStore((s) => s.setShowProductPicker);
  const setProductSearch = useDesignStore((s) => s.setProductSearch);
  const setProductPickerCategory = useDesignStore((s) => s.setProductPickerCategory);

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    return PRODUCTS.filter((product) => {
      const inCategory = productPickerCategory === "all" || product.category === productPickerCategory;
      const inSearch = !search || `${product.name} ${product.description}`.toLowerCase().includes(search);
      return inCategory && inSearch;
    });
  }, [productPickerCategory, productSearch]);

  const chooseProduct = (product: DesignProduct) => {
    if (product.id !== selectedProduct.id) {
      // Keep the user's layers for the apply-to-product workflow, but never
      // keep the old catalog product identity, price, or incompatible face.
      setProduct(product);
      setLinkedStoreProduct(null);
      setQuantity(1);
      setFace("front");
      if (product.category !== "mug") setMugMode("side1");
    }
    setProductSearch("");
    setProductPickerCategory("all");
    setShowProductPicker(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowProductPicker(true)}
        aria-haspopup="dialog"
        aria-expanded={showProductPicker}
        className="group flex min-w-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-xs font-black shadow-sm transition hover:border-orange-400 hover:shadow-md active:scale-[0.98]"
      >
        <Package className="h-4 w-4 shrink-0 text-orange-500" />
        <span className="min-w-0 truncate text-gray-800">{selectedProduct.name}</span>
        <span className="hidden shrink-0 text-[10px] font-bold text-gray-400 sm:inline">{selectedProduct.description}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
      </button>

      {showProductPicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Choose a product to customize">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] bg-[#faf9f6] shadow-2xl sm:max-h-[86vh] sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-gray-900 sm:text-base">
                  <Sparkles className="h-4 w-4 text-orange-500" /> Choose your product
                </div>
                <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">Select a real preview. Your current artwork stays attached and is automatically reapplied to the new product.</p>
              </div>
              <button type="button" onClick={() => setShowProductPicker(false)} aria-label="Close product picker" className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products…" className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar sm:max-w-[64%]">
                  {CATEGORY_LABELS.map((category) => (
                    <button key={category.id} type="button" onClick={() => setProductPickerCategory(category.id)} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black transition active:scale-95 ${productPickerCategory === category.id ? "bg-gray-900 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-600"}`}>
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((product) => {
                    const active = product.id === selectedProduct.id;
                    return (
                      <button key={product.id} type="button" onClick={() => chooseProduct(product)} className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] ${active ? "border-orange-500 ring-2 ring-orange-100" : "border-gray-200 hover:border-orange-300"}`}>
                        <div className="relative aspect-square overflow-hidden bg-[#f5f3f0]">
                          <img src={product.frontSrc} alt={`${product.name} mockup preview`} className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105" loading="lazy" />
                          {active && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-md"><Check className="h-4 w-4" /></span>}
                        </div>
                        <div className="p-3">
                          <div className="truncate text-xs font-black text-gray-900">{product.icon} {product.name}</div>
                          <div className="mt-1 truncate text-[10px] font-semibold text-gray-500">{product.description}</div>
                          {product.badge && <span className="mt-2 inline-flex rounded-full bg-orange-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-orange-600">{product.badge}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center text-sm text-gray-500">No product matches this search. Try another category or keyword.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
