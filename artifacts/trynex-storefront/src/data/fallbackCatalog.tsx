import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@workspace/api-client-react";

/**
 * Static six-family catalogue shown when Render/Neon is unreachable.
 * Cards link to live shop filters or Design Studio — never to fake product IDs
 * that would 404 or create bogus cart lines.
 */
export interface FallbackProduct {
  id: string;
  name: string;
  categoryName: string;
  price: number;
  imageUrl: string;
  shopHref: string;
  studioHref: string;
}

export const FALLBACK_FEATURED_PRODUCTS: FallbackProduct[] = [
  {
    id: "family-tshirt",
    name: "Custom T-Shirt",
    categoryName: "T-Shirts",
    price: 450,
    imageUrl: "/mockups/smart-v9/tshirt/white/front.png",
    shopHref: "/products?category=t-shirts",
    studioHref: "/design-studio?product=tshirt",
  },
  {
    id: "family-hoodie",
    name: "Custom Hoodie",
    categoryName: "Hoodies",
    price: 1699,
    imageUrl: "/mockups/smart-v9/hoodie/white/front.png",
    shopHref: "/products?category=hoodies",
    studioHref: "/design-studio?product=hoodie",
  },
  {
    id: "family-mug",
    name: "Custom Mug",
    categoryName: "Mugs",
    price: 449,
    imageUrl: "/mockups/smart-v9/mug/white/front.png",
    shopHref: "/products?category=mugs",
    studioHref: "/design-studio?product=mug",
  },
  {
    id: "family-cap",
    name: "Custom Cap",
    categoryName: "Caps",
    price: 699,
    imageUrl: "/mockups/smart-v9/cap/white/front.png",
    shopHref: "/products?category=caps",
    studioHref: "/design-studio?product=cap",
  },
  {
    id: "family-longsleeve",
    name: "Custom Long Sleeve",
    categoryName: "Long Sleeves",
    price: 1299,
    imageUrl: "/mockups/smart-v9/longsleeve/white/front.png",
    shopHref: "/products?category=long-sleeves",
    studioHref: "/design-studio?product=longsleeve",
  },
  {
    id: "family-bottle",
    name: "Custom Water Bottle",
    categoryName: "Water Bottles",
    price: 899,
    imageUrl: "/mockups/smart-v9/waterbottle/white/front.png",
    shopHref: "/products?category=water-bottles",
    studioHref: "/design-studio?product=waterbottle",
  },
];

export function toPlaceholderProducts(items: FallbackProduct[] = FALLBACK_FEATURED_PRODUCTS): Product[] {
  return items.map((item, index) => ({
    id: -(index + 1),
    slug: item.id,
    name: item.name,
    description: `Customize your ${item.name.toLowerCase()} in the Design Studio.`,
    price: String(item.price),
    imageUrl: item.imageUrl,
    categoryName: item.categoryName,
    stock: 99,
    featured: true,
    customizable: true,
    tags: ["fallback-catalog"],
  }));
}

export function FallbackProductCard({ product, index = 0 }: { product: FallbackProduct; index?: number }) {
  return (
    <article
      className="h-full rounded-2xl overflow-hidden bg-white flex flex-col"
      style={{ border: "1.5px solid #f0e8e0", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      data-testid={`fallback-product-${product.id}`}
      data-fallback-index={index}
    >
      <Link href={product.shopHref} className="block aspect-[4/5] overflow-hidden" style={{ background: "#f9f5f2" }}>
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain p-4"
          loading={index < 2 ? "eager" : "lazy"}
          decoding="async"
        />
      </Link>
      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">{product.categoryName}</p>
        <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2">{product.name}</h3>
        <p className="font-black text-orange-600 text-base mb-3">{formatPrice(product.price)}</p>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Link
            href={product.shopHref}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-orange-200 bg-orange-50 px-2 text-xs font-bold text-orange-700"
          >
            Shop <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            href={product.studioHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-2 text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
          >
            Design
          </Link>
        </div>
      </div>
    </article>
  );
}
