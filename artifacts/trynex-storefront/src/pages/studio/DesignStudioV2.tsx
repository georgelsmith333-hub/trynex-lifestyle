import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCartActions, type OriginalAsset } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, RotateCcw, Trash2, ShoppingCart, ZoomIn, ZoomOut, RotateCw,
  Move, Ruler, ArrowUp, ArrowDown, Scissors, Info, Eye, EyeOff, Loader2,
  Wand2, Type, Layers as LayersIcon, Sparkles, Undo2, Redo2, Lock, Unlock,
  ChevronUp, ChevronDown, Image as ImageIcon, Plus, Check, CloudUpload,
  Search, X, ChevronRight, Palette, Package, FlipHorizontal, Copy,
  Crosshair, Maximize2, Download, AlignLeft, AlignCenter, AlignRight,
  ShieldCheck,
} from "lucide-react";
import {
  PRODUCTS, GarmentSVG, FlatZoneSVG, MUG_SIDE_PZ, MUG_SIDE_BACK_PZ, resolveMockup,
  getApparelZones, getZonePZ, type ApparelZone, isNearBlack, isLightTint,
  type PrintZone, type DesignProduct, type Face,
} from "../design-studio/mockups";
import {
  composeLayers, composeGarmentMockup, composeDesignTexture, autoFixImage,
  type ComposerLayer,
} from "../design-studio/composer";

import { useDesignStore } from "@/hooks/useDesignStore";
import { LayerPanel } from "./panels/LayerPanel";
import { TextPanel } from "./panels/TextPanel";
import { ImagePanel } from "./panels/ImagePanel";
import { ShapePanel } from "./panels/ShapePanel";
import { MainToolbar } from "./toolbar/MainToolbar";
import { ProductSwitcher } from "./toolbar/ProductSwitcher";
import { CanvasArea } from "./CanvasArea";
import { AIPanel } from "./AIPanel";
import { ClipArtBrowser } from "./ClipArtBrowser";
import { QRCodePanel } from "./QRCodePanel";
import { FONT_FAMILIES, type Layer, type ImageLayer, type TextLayer, DRAFT_VERSION } from "./types";

const LazyProductViewer3D = lazy(() => import("../design-studio/ProductViewer3D"));

const DRAFT_STORAGE_KEY = "trynex-design-draft-v2";
const SIZE_CHART = [
  { size: "XS", chest: "36", length: "26" }, { size: "S", chest: "38", length: "27" },
  { size: "M", chest: "40", length: "28" }, { size: "L", chest: "42", length: "29" },
  { size: "XL", chest: "44", length: "30" }, { size: "XXL", chest: "46", length: "31" },
  { size: "XXXL", chest: "48", length: "32" },
];

const QUICK_PRODUCT_IDS = ["tshirt", "hoodie", "mug", "cap"] as const;
const LEGACY_ID_MAP: Record<string, string> = {
  "white-tshirt": "tshirt", "black-tshirt": "tshirt",
  "white-hoodie": "hoodie", "black-hoodie": "hoodie",
  "white-longsleeve": "longsleeve", "black-longsleeve": "longsleeve",
  "white-mug": "mug", "black-mug": "mug",
  "white-cap": "cap", "black-cap": "cap",
  "white-waterbottle": "waterbottle", "black-waterbottle": "waterbottle",
};

function uid() { return Math.random().toString(36).slice(2, 10); }

function detectCategoryFromProduct(prod: any): DesignProduct["category"] {
  const text = [prod.name ?? "", prod.category?.name ?? "", prod.categoryName ?? ""].join(" ").toLowerCase();
  if (text.includes("mug") || text.includes("cup")) return "mug";
  if (text.includes("hoodie") || text.includes("sweatshirt")) return "hoodie";
  if (text.includes("cap") || text.includes("hat")) return "cap";
  if (text.includes("long sleeve") || text.includes("longsleeve") || text.includes("long-sleeve")) return "longsleeve";
  if (text.includes("bottle") || text.includes("tumbler") || text.includes("flask")) return "waterbottle";
  return "tshirt";
}

function detectColorFromProduct(prod: any): string {
  const name = (prod.name ?? "").toLowerCase();
  if (name.includes("black")) return "#1a1a1a";
  if (name.includes("navy")) return "#1e3a5f";
  if (name.includes("maroon")) return "#7f1d1d";
  if (name.includes("grey") || name.includes("gray")) return "#6b7280";
  if (name.includes("olive")) return "#4a5240";
  if (Array.isArray(prod.colors) && prod.colors.length > 0) {
    const first = prod.colors[0];
    if (typeof first === "string" && first.startsWith("#")) return first;
    if (typeof first === "object" && first?.hex) return first.hex;
  }
  return "#F5F5F3";
}

export default function DesignStudioV2() {
  const [, navigate] = useLocation();
  const { addToCart } = useCartActions();
  const settings = useSiteSettings();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(600);

  const store = useDesignStore();
  const {
    selectedProduct, selectedColor, activeFace, mugMode, selectedSize, quantity,
    layers, selectedIds, linkedStoreProduct, showPrintZone, show3D, activeTab,
    saveStatus, hasDraft, isMobile, fabricTexture,
    setProduct, setColor, setFace, setMugMode, setSize, setQuantity,
    addLayer, updateLayer, deleteLayer, moveLayer, setLayerVisibility, selectLayer, clearSelection, setLayers,
    undo, redo, setShowPrintZone, setActiveTab, setShow3D, setLinkedStoreProduct, setSaveStatus, setHasDraft,
  } = store;

  const selectedLayerId = selectedIds[0] ?? null;
  const selectedLayer = useMemo(() => layers.find(l => l.id === selectedLayerId) ?? null, [layers, selectedLayerId]);

  const isMug = selectedProduct.category === "mug";
  const isCap = selectedProduct.category === "cap";
  const isWaterBottle = selectedProduct.category === "waterbottle";
  const supportsBack = ["tshirt", "longsleeve", "hoodie", "mug"].includes(selectedProduct.category);
  const isZoneTabs = ["tshirt", "longsleeve", "hoodie"].includes(selectedProduct.category);
  const frontMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, "front"),
    [selectedProduct, selectedColor.hex],
  );
  const backMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, "back"),
    [selectedProduct, selectedColor.hex],
  );

  const apparelZones = useMemo(() => getApparelZones(selectedProduct.category, selectedProduct.printZone, selectedProduct.printZoneBack), [selectedProduct]);
  const activeZoneConfig = useMemo(() => apparelZones.find(z => z.face === activeFace) ?? apparelZones[0], [apparelZones, activeFace]);
  const isFlatZone = activeFace === "left-sleeve" || activeFace === "right-sleeve" || activeFace === "neck-label";

  const pz = useMemo(() => {
    if (isMug) return activeFace === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ;
    return getZonePZ(activeFace, selectedProduct);
  }, [isMug, activeFace, selectedProduct]);

  const isBlackGarment = isNearBlack(selectedColor.hex);
  const isLightGarment = isLightTint(selectedColor.hex);

  useEffect(() => {
    const onResize = () => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      const mobile = window.innerWidth < 768;
      store.setIsMobile(mobile);
      const maxWidth = mobile ? width - 32 : Math.min(width - 360, 720);
      setCanvasSize(Math.max(320, Math.min(maxWidth, 720)));
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [store]);

  // URL params + draft restore
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const isEdit = sp.get("edit") === "1";
    const token = localStorage.getItem("trynex_customer_token");
    const restore = async () => {
      if (token) {
        try {
          const res = await fetch(getApiUrl("/api/drafts"), { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const json = await res.json();
            if (json.draft?.payload) applyDraftPayload(json.draft.payload, "cloud");
          }
        } catch {}
      }
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) applyDraftPayload(JSON.parse(raw), "local");
      } catch {}
    };
    restore();
    const urlProduct = sp.get("product");
    if (urlProduct) {
      const resolved = LEGACY_ID_MAP[urlProduct] ?? urlProduct;
      const found = PRODUCTS.find(p => p.id === resolved || p.category === resolved);
      if (found) { setProduct(found); setColor(found.colors[0]); }
    }
    const storeProductId = sp.get("storeProductId");
    if (storeProductId) {
      fetch(getApiUrl(`/api/products/${storeProductId}`))
        .then(r => r.ok ? r.json() : null)
        .then((found: any) => {
          if (!found) return;
          const category = detectCategoryFromProduct(found);
          const template = PRODUCTS.find(p => p.category === category) ?? PRODUCTS[0];
          const garmentColor = detectColorFromProduct(found);
          const price = parseFloat(String(found.discountPrice || found.price)) || 0;
          setProduct(template);
          const colorMatch = template.colors.find(c => c.hex.toLowerCase() === garmentColor.toLowerCase()) ?? template.colors[0];
          setColor(colorMatch);
          setLinkedStoreProduct({ id: found.id, name: found.name, price, imageUrl: found.imageUrl ?? undefined });
          toast({ title: `Designing: ${found.name}`, description: "Upload your artwork or add text to customise this product." });
        })
        .catch(() => {});
    }
    const urlTab = sp.get("tab");
    if (urlTab && ["upload", "text", "layers", "templates", "ai"].includes(urlTab)) {
      setActiveTab(urlTab as any);
    }
    if (sp.get("view") === "back") setFace("back");
    const urlSize = sp.get("size");
    if (urlSize && ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].includes(urlSize)) setSize(urlSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDraftPayload(data: any, source: "cloud" | "local") {
    if (!data || data.version !== DRAFT_VERSION) return;
    if (typeof data.productId === "string") {
      const resolved = LEGACY_ID_MAP[data.productId] ?? data.productId;
      const p = PRODUCTS.find(x => x.id === resolved);
      if (p) setProduct(p);
    }
    if (data.color?.hex && data.color?.name) setColor(data.color);
    if (typeof data.size === "string") setSize(data.size);
    if (data.mugMode) setMugMode(data.mugMode);
    if (data.linkedStoreProductId) setLinkedStoreProduct({ id: data.linkedStoreProductId, name: data.linkedStoreProductName, price: data.linkedStoreProductPrice });
    if (Array.isArray(data.layers) && data.layers.length > 0) {
      setLayers(data.layers);
      setHasDraft(true);
      setSaveStatus("saved");
      toast({ title: "Draft restored", description: source === "cloud" ? "Loaded from cloud." : "Welcome back — your design is here." });
    }
  }

  // Auto-save draft
  useEffect(() => {
    if (layers.length === 0) {
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      setHasDraft(false);
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    const handle = window.setTimeout(async () => {
      const payload = {
        version: DRAFT_VERSION, layers, productId: selectedProduct.id, color: selectedColor, size: selectedSize,
        mugMode, savedAt: Date.now(),
        ...(linkedStoreProduct ? { linkedStoreProductId: linkedStoreProduct.id, linkedStoreProductName: linkedStoreProduct.name, linkedStoreProductPrice: linkedStoreProduct.price } : {}),
      };
      try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload)); } catch {}
      const token = localStorage.getItem("trynex_customer_token");
      if (token) {
        try {
          await fetch(getApiUrl("/api/drafts"), {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
            body: JSON.stringify({ payload }),
          });
        } catch {}
      }
      setHasDraft(true);
      setSaveStatus("saved");
    }, 500);
    return () => window.clearTimeout(handle);
  }, [layers, selectedProduct, selectedColor, selectedSize, mugMode, linkedStoreProduct]);

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (linkedStoreProduct) params.set("storeProductId", String(linkedStoreProduct.id));
    else if (selectedProduct.id !== PRODUCTS[0].id) params.set("product", selectedProduct.id);
    if (activeTab !== "upload") params.set("tab", activeTab);
    if (activeFace !== "front") params.set("view", activeFace);
    if (selectedSize !== "M") params.set("size", selectedSize);
    const q = params.toString();
    const newUrl = window.location.pathname + (q ? "?" + q : "");
    if (newUrl !== window.location.pathname + window.location.search) window.history.replaceState(null, "", newUrl);
  }, [selectedProduct.id, activeTab, activeFace, selectedSize, linkedStoreProduct]);

  const handleQuickProductSwitch = (prod: DesignProduct) => {
    if (prod.id === selectedProduct.id) return;
    setProduct(prod);
    const matchingColor = prod.colors.find(c => c.hex.toLowerCase() === selectedColor.hex.toLowerCase()) ?? prod.colors[0];
    setColor(matchingColor);
    setLinkedStoreProduct(null);
    setQuantity(1);
    setFace("front");
    if (prod.category !== "mug") setMugMode("side1");
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB. Please compress or resize the image first.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast({ title: "Couldn't read file", description: "Try another image.", variant: "destructive" });
    reader.onload = async (e) => {
      const src = e.target?.result as string;
      if (!src) return;
      const img = new Image();
      img.src = src;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
      try { await img.decode?.(); } catch {}
      const fixed = await autoFixImage(src);
      const aspect = img.naturalWidth / Math.max(img.naturalHeight, 1);
      const maxScaleForHeight = (pz.h * aspect) / pz.w;
      const initialScale = Math.min(1.0, maxScaleForHeight) * 0.95;
      const layer: ImageLayer = {
        id: uid(), name: file.name.replace(/\.[^.]+$/, "") || "Image",
        type: "image", src: fixed.src, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
        visible: true, locked: false,
        transform: { x: 0, y: 0, scale: initialScale, rotation: 0, opacity: 1 },
        face: activeFace, brightness: fixed.brightness, contrast: fixed.contrast,
      };
      addLayer(layer);
      selectLayer(layer.id);
      setActiveTab("layers");
      toast({ title: "✓ Design placed!", description: "Tap your design to move, resize or adjust it." });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const addText = () => {
    const layer: TextLayer = {
      id: uid(), name: "New text", type: "text", visible: true, locked: false,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      text: "Your text", fontFamily: FONT_FAMILIES[0].value, fontWeight: 700, fontStyle: "normal", fontSize: 40, color: "#111111",
      face: activeFace,
    };
    addLayer(layer);
    selectLayer(layer.id);
    setActiveTab("text");
  };

  const frontLayers = useMemo(() => layers.filter(l => l.type !== "shape" && (l.face ?? "front") === "front") as unknown as ComposerLayer[], [layers]);
  const backLayers = useMemo(() => layers.filter(l => l.type !== "shape" && (l.face ?? "front") === "back") as unknown as ComposerLayer[], [layers]);

  const handleAddToCart = async () => {
    if (layers.length === 0) {
      toast({ title: "No design", description: "Add an image or text layer first.", variant: "destructive" });
      return;
    }
    const imageCache = new Map<string, HTMLImageElement>();
    const originalAssets: OriginalAsset[] = [];
    const originalAssetUrls: string[] = [];
    for (const layer of layers) {
      if (layer.type !== "image" || !layer.visible) continue;
      const src = (layer as ImageLayer).src;
      if (!src.startsWith("data:")) continue;
      try {
        const blob = await (await fetch(src)).blob();
        const mime = blob.type || "image/png";
        const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
        const safeName = (layer.name || "design").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const filename = `${safeName}-${Date.now()}.${ext}`;
        const reqRes = await fetch(getApiUrl("/api/storage/uploads/request-url"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: filename, size: blob.size, contentType: mime }),
        });
        if (!reqRes.ok) continue;
        const { uploadURL, objectPath } = await reqRes.json();
        const putRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
        if (putRes.ok && objectPath) {
          originalAssets.push({ objectPath, filename, mime, bytes: blob.size, width: (layer as ImageLayer).naturalW, height: (layer as ImageLayer).naturalH });
          originalAssetUrls.push(objectPath);
        }
      } catch {}
    }

    const garmentSrc = frontMockup.photoKind === "opaque-photo" && !frontMockup.requiresTint
      ? frontMockup.photoSrc
      : frontMockup.cutoutSrc;
    const isColorPhoto = frontMockup.isColorPhoto;
    const frontPZ = isMug ? MUG_SIDE_PZ : selectedProduct.printZone;
    const backPZ = isMug ? MUG_SIDE_BACK_PZ : (selectedProduct.printZoneBack ?? selectedProduct.printZone);
    const leftSleeveLayers = layers.filter(l => l.type !== "shape" && l.face === "left-sleeve") as unknown as ComposerLayer[];
    const rightSleeveLayers = layers.filter(l => l.type !== "shape" && l.face === "right-sleeve") as unknown as ComposerLayer[];
    const neckLabelLayers = layers.filter(l => l.type !== "shape" && l.face === "neck-label") as unknown as ComposerLayer[];

    let mockupUrl: string;
    try {
      const mockupCanvas = document.createElement("canvas");
      await composeGarmentMockup({ canvas: mockupCanvas, garmentSrc, garmentColor: selectedColor.hex, printZone: frontPZ, layers: frontLayers, outSize: 400, imageCache, isColorPhoto, requiresTint: frontMockup.requiresTint, fabricTexture });
      mockupUrl = mockupCanvas.toDataURL("image/webp", 0.8);
    } catch (err) {
      console.error("Mockup compose failed", err);
      toast({ title: "Preview failed", description: "Could not generate the design preview. Try a different image or refresh.", variant: "destructive" });
      return;
    }

    let frontTexUrl: string;
    try {
      const frontTexCanvas = document.createElement("canvas");
      if (isMug) {
        await composeLayers({ canvas: frontTexCanvas, baseHeight: selectedProduct.baseHeight, printZone: frontPZ, layers: frontLayers, garmentColor: null, outW: 2048, outH: 768, imageCache, clipToPrintZone: true, blendMode: "multiply", curvature: 0.16, fabricTexture });
      } else {
        await composeDesignTexture({ canvas: frontTexCanvas, printZone: frontPZ, layers: frontLayers, outSize: 1024, imageCache, curvature: isWaterBottle ? 0.16 : isCap ? 0.1 : 0, fabricTexture });
      }
      frontTexUrl = frontTexCanvas.toDataURL("image/webp", 0.85);
    } catch (err) {
      console.error("Front texture compose failed", err);
      toast({ title: "Print preview failed", description: "Could not generate the printable texture. Try a different image or refresh.", variant: "destructive" });
      return;
    }

    let backTexUrl: string | undefined;
    if (!isMug && backLayers.length > 0) {
      const backTexCanvas = document.createElement("canvas");
      await composeDesignTexture({ canvas: backTexCanvas, printZone: backPZ, layers: backLayers, outSize: 1024, imageCache, fabricTexture });
      backTexUrl = backTexCanvas.toDataURL("image/webp", 0.85);
    }

    let leftSleeveTexUrl: string | undefined;
    let rightSleeveTexUrl: string | undefined;
    let neckLabelTexUrl: string | undefined;
    if (isZoneTabs) {
      const { SLEEVE_PZ, NECK_LABEL_PZ } = await import("../design-studio/mockups");
      if (leftSleeveLayers.length > 0) {
        const c = document.createElement("canvas");
        await composeDesignTexture({ canvas: c, printZone: SLEEVE_PZ, layers: leftSleeveLayers, outSize: 1024, imageCache, fabricTexture });
        leftSleeveTexUrl = c.toDataURL("image/webp", 0.85);
      }
      if (rightSleeveLayers.length > 0) {
        const c = document.createElement("canvas");
        await composeDesignTexture({ canvas: c, printZone: SLEEVE_PZ, layers: rightSleeveLayers, outSize: 1024, imageCache, fabricTexture });
        rightSleeveTexUrl = c.toDataURL("image/webp", 0.85);
      }
      if (neckLabelLayers.length > 0) {
        const c = document.createElement("canvas");
        await composeDesignTexture({ canvas: c, printZone: NECK_LABEL_PZ, layers: neckLabelLayers, outSize: 1024, imageCache, fabricTexture });
        neckLabelTexUrl = c.toDataURL("image/webp", 0.85);
      }
    }

    const studioPrice = linkedStoreProduct?.price ?? (isMug || isWaterBottle ? (settings.studioMugPrice || 799) : (settings.studioTshirtPrice || 1099));
    const sessionId = Date.now().toString(36);
    try {
      localStorage.setItem(`studio_session_${sessionId}`, JSON.stringify({ version: DRAFT_VERSION, layers, productId: selectedProduct.id, color: selectedColor, size: selectedSize, savedAt: Date.now() }));
    } catch {}

    addToCart({
      productId: linkedStoreProduct?.id ?? 0,
      name: linkedStoreProduct?.name ?? `Custom ${selectedProduct.name}`,
      price: studioPrice,
      quantity,
      size: isMug || isCap || isWaterBottle ? undefined : selectedSize,
      color: selectedColor.name,
      imageUrl: mockupUrl,
      customImages: [frontTexUrl, ...(backTexUrl ? [backTexUrl] : []), ...(leftSleeveTexUrl ? [leftSleeveTexUrl] : []), ...(rightSleeveTexUrl ? [rightSleeveTexUrl] : []), ...(neckLabelTexUrl ? [neckLabelTexUrl] : [])],
      originalAssetUrls,
      originalAssets,
      customNote: JSON.stringify({ studioDesign: true, sessionId, product: selectedProduct.name, category: selectedProduct.category, color: selectedColor.name, colorHex: selectedColor.hex, size: selectedSize, layerCount: layers.length, frontLayerCount: frontLayers.length, backLayerCount: backLayers.length, mockupSrc: garmentSrc, mockupSource: frontMockup.source, mockupPhotoSrc: frontMockup.photoSrc, mockupIsColorPhoto: frontMockup.isColorPhoto, printZone: frontPZ, printZoneBack: backPZ, originalAssets }),
    });
    toast({ title: "✓ Added to cart!", description: `Custom ${selectedProduct.name} (${selectedColor.name}) is ready.` });
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
    setHasDraft(false);
    setSaveStatus("idle");
    setTimeout(() => navigate("/cart"), 800);
  };

  const handleExportPNG = async () => {
    const activeLayers = layers.filter(l => l.type !== "shape" && (l.face ?? "front") === activeFace) as unknown as ComposerLayer[];
    if (activeLayers.length === 0) { toast({ title: "Nothing to export", description: "Add a layer first." }); return; }
    const garmentSrc = frontMockup.photoKind === "opaque-photo" && !frontMockup.requiresTint
      ? frontMockup.photoSrc
      : frontMockup.cutoutSrc;
    const canvas = document.createElement("canvas");
    await composeGarmentMockup({ canvas, garmentSrc, garmentColor: selectedColor.hex, printZone: isMug ? (activeFace === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ) : selectedProduct.printZone, layers: activeLayers, outSize: 1200, isColorPhoto: frontMockup.isColorPhoto, requiresTint: frontMockup.requiresTint, fabricTexture });
    const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `trynex-${selectedProduct.id}-${activeFace}-design.png`; a.click();
    toast({ title: "PNG exported!", description: "High-res PNG saved to your downloads." });
  };

  const studioColors = useMemo(() => {
    try {
      const raw = isMug ? settings.studioMugColors : (!isCap && !isWaterBottle) ? settings.studioTshirtColors : null;
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) return arr;
    } catch {}
    return selectedProduct.colors;
  }, [isMug, isCap, isWaterBottle, settings, selectedProduct]);

  const currentFaceLayers = useMemo(() => layers.filter(l => (l.face ?? "front") === activeFace), [layers, activeFace]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F3F0" }}>
      <SEOHead title="Design Studio | Create Custom Apparel Online — TryNex Lifestyle" description="Design your own custom T-shirts, hoodies, mugs & more." canonical="/design-studio" />
      <Navbar />
      <div style={{ height: "calc(var(--announcement-height, 0px) + 4.25rem)" }} />

      <div className="border-b border-gray-200 sticky z-30 bg-white" style={{ top: "calc(var(--announcement-height, 0px) + 4.25rem)" }}>
        <div className="container-wide mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-shrink">
            <h1 className="font-display font-black text-base sm:text-xl text-gray-900 truncate">Design Studio</h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Designing: <strong className="text-gray-700">{linkedStoreProduct?.name ?? selectedProduct.name}</strong>
              {linkedStoreProduct && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white bg-orange-500">STORE</span>}
              <span className="text-gray-400"> · {isMug ? (mugMode === "side1" ? "Left Side" : mugMode === "side2" ? "Right Side" : "Full Wrap") : (activeZoneConfig?.label ?? activeFace)}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {(saveStatus !== "idle" || hasDraft) && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: saveStatus === "saving" ? "#f3f4f6" : "#ecfdf5", color: saveStatus === "saving" ? "#6b7280" : "#047857" }}>
                {saveStatus === "saving" ? <><CloudUpload className="w-3 h-3 animate-pulse" /> Saving…</> : <><Check className="w-3 h-3" /> Saved</>}
              </div>
            )}
            <button onClick={undo} disabled={store.history.length <= 1} className="p-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /></button>
            <button onClick={redo} disabled={store.future.length === 0} className="p-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30"><Redo2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowPrintZone(!showPrintZone)} className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${showPrintZone ? "text-orange-500 bg-orange-50" : "text-gray-500 bg-gray-100"}`}><Eye className="w-3 h-3" /> Print Zone</button>
            {!isFlatZone && <button onClick={() => setShow3D(!show3D)} className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${show3D ? "text-blue-500 bg-blue-50" : "text-gray-500 bg-gray-100"}`}><Package className="w-3 h-3" /> {show3D ? "2D Edit" : "3D Preview"}</button>}
            <motion.button onClick={handleAddToCart} whileTap={{ scale: 0.97 }} className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white" style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 12px rgba(232,93,4,0.35)" }}>
              <ShoppingCart className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add to Cart</span><span className="sm:hidden">Cart</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 container-wide mx-auto w-full px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 min-w-0" ref={containerRef}>
            <ProductSwitcher />
            <div className="mt-3 mb-3">
              <MainToolbar />
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }} />

            {isZoneTabs && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: "none" }}>
                {apparelZones.map(zone => {
                  const isActive = activeFace === zone.face;
                  const count = layers.filter(l => (l.face ?? "front") === zone.face).length;
                  return (
                    <button key={zone.face} onClick={() => setFace(zone.face)} className="relative shrink-0 px-3.5 py-2 rounded-xl text-xs font-black" style={{ background: isActive ? "#1C1C1E" : "white", color: isActive ? "white" : "#374151", border: isActive ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb" }}>
                      {zone.shortLabel}
                      {count > 0 && !isActive && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white bg-orange-500">{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {isMug && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                {(["side1", "side2", "wrap"] as const).map(v => (
                  <button key={v} onClick={() => setMugMode(v)} className="shrink-0 px-4 py-2 rounded-xl text-xs font-black" style={{ background: mugMode === v ? "#1C1C1E" : "white", color: mugMode === v ? "white" : "#374151", border: mugMode === v ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb" }}>
                    {v === "side1" ? "Left Side" : v === "side2" ? "Right Side" : "Wrap"}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-gray-400" /><span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Color</span></div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: selectedColor.hex, color: isLightTint(selectedColor.hex) ? "#374151" : "white" }}>{selectedColor.name}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {studioColors.map((c: any) => {
                  const isSelected = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button key={c.hex} title={c.name} onClick={() => setColor(c)} className="relative touch-manipulation flex-shrink-0 transition-transform duration-100 hover:scale-110" style={{ width: 34, height: 34 }}>
                      {isSelected && <span className="absolute inset-0 rounded-full pointer-events-none" style={{ border: "2.5px solid #E85D04", transform: "scale(1.28)", boxShadow: "0 0 0 2px rgba(232,93,4,0.20)" }} />}
                      <span className="absolute rounded-full transition-transform duration-100" style={{ inset: 3, background: c.hex, border: isLightTint(c.hex) ? "1.5px solid #d1d5db" : "1px solid rgba(0,0,0,0.10)", transform: isSelected ? "scale(0.88)" : "scale(1)", boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.28)" : "0 1px 4px rgba(0,0,0,0.14)" }} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative rounded-3xl overflow-hidden select-none" style={{ background: "radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f8f8f8 55%, #f0f0f0 100%)", border: "1px solid #e5e5e7", boxShadow: "0 6px 40px rgba(0,0,0,0.08)" }} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
              <div style={{ position: "relative", width: canvasSize, height: canvasSize, margin: "0 auto" }}>
                {show3D && !isFlatZone && (
                  <div className="absolute inset-0 z-20 rounded-3xl overflow-hidden flex items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 40%, #f4f4f4 0%, #e8e8e8 100%)" }}>
                    <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-blue-400" />}>
                      <LazyProductViewer3D product={selectedProduct} garmentColor={selectedColor.hex} front={{ layers: frontLayers, printZone: isMug ? MUG_SIDE_PZ : selectedProduct.printZone, baseHeight: selectedProduct.baseHeight }} back={supportsBack && backLayers.length > 0 ? { layers: backLayers, printZone: isMug ? MUG_SIDE_BACK_PZ : (selectedProduct.printZoneBack ?? selectedProduct.printZone), baseHeight: selectedProduct.baseHeight } : undefined} activeFace={activeFace as "front" | "back"} isWrapMode={isMug && frontLayers.length > 0 && backLayers.length > 0} />
                    </Suspense>
                    <button onClick={() => setShow3D(false)} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold text-white" style={{ background: "rgba(17,24,39,0.78)" }}><Eye className="w-3 h-3 inline" /> Back to 2D</button>
                  </div>
                )}
                <CanvasArea
                  width={canvasSize}
                  height={canvasSize}
                  printZone={pz}
                  mockup={
                    isFlatZone && activeZoneConfig
                      ? <FlatZoneSVG zone={activeZoneConfig} showPrintZone={showPrintZone} mockup={frontMockup} />
                      : <GarmentSVG product={selectedProduct} color={selectedColor.hex} showPrintZone={showPrintZone} face={activeFace} mugMode={isMug ? mugMode : undefined} />
                  }
                />
              </div>
            </div>

            {currentFaceLayers.length > 0 && (
              <div className="px-4 py-2 mt-2 text-[10px] font-semibold text-gray-500 flex items-center gap-2 bg-white border-t border-gray-200">
                <Move className="w-3 h-3" /> Drag · Pinch to scale & rotate · +/− to zoom
              </div>
            )}
          </div>

          <div className="md:w-[320px] lg:w-[340px] shrink-0 flex flex-col gap-4">
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col">
              <div className="flex p-1.5 gap-1 bg-[#f8f7f5] rounded-t-2xl border-b border-gray-200">
                {[
                  { id: "upload" as const, label: "Upload", icon: Upload },
                  { id: "text" as const, label: "Text", icon: Type },
                  { id: "ai" as const, label: "AI Art", icon: Wand2 },
                  { id: "layers" as const, label: "Layers", icon: LayersIcon },
                  { id: "templates" as const, label: "Templates", icon: Sparkles },
                  { id: "qrcode" as const, label: "QR", icon: Crosshair },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)} className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[9px] font-black transition-all" style={{ background: activeTab === id ? "white" : "transparent", color: activeTab === id ? "#E85D04" : "#9ca3af", boxShadow: activeTab === id ? "0 1px 6px rgba(0,0,0,0.10)" : "none" }}>
                    <Icon className="w-4 h-4" />{label}
                    {id === "layers" && layers.length > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black text-white bg-orange-500">{layers.length}</span>}
                  </button>
                ))}
              </div>
              <div className="p-2">
                {activeTab === "upload" && (
                  <div className="p-4 space-y-3">
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }}><Upload className="w-4 h-4" /> Upload Image</button>
                    <p className="text-[11px] text-gray-500 text-center">JPG, PNG, or WebP · Max 10MB</p>
                    {selectedLayer?.type === "image" && <ImagePanel />}
                    {!isMug && !isCap && !isWaterBottle && (
                      <div className="pt-3 border-t border-gray-100">
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Garment Size</label>
                        <div className="flex flex-wrap gap-1.5">
                          {SIZE_CHART.map(s => (
                            <button key={s.size} onClick={() => setSize(s.size)} className="px-3 py-1.5 rounded-lg text-xs font-black transition-all" style={{ background: selectedSize === s.size ? "linear-gradient(135deg,#E85D04,#FB8500)" : "#f3f4f6", color: selectedSize === s.size ? "white" : "#374151" }}>{s.size}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "text" && <TextPanel />}
                {activeTab === "layers" && (
                  <div className="p-2">
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white"><ImageIcon className="w-3.5 h-3.5" /> Image</button>
                      <button onClick={addText} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white"><Type className="w-3.5 h-3.5" /> Text</button>
                    </div>
                    <LayerPanel />
                    {selectedLayer?.type === "shape" && <ShapePanel />}
                  </div>
                )}
                {activeTab === "templates" && <ClipArtBrowser />}
                {activeTab === "ai" && <AIPanel />}
                {activeTab === "qrcode" && <QRCodePanel />}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Export</label>
              <div className="flex gap-2">
                <button onClick={handleExportPNG} className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-1"><Download className="w-3 h-3" /> PNG</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
