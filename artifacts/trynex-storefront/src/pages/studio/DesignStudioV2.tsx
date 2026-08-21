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
  PRODUCTS, GarmentSVG, FlatZoneSVG, MUG_PZ, MUG_WRAP_BACK_PZ, MUG_SIDE_PZ, MUG_SIDE_BACK_PZ, resolveMockup,
  getApparelZones, getZonePZ, setRuntimeMockupOverrides, type ApparelZone, isNearBlack, isLightTint,
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
import { fitImageTransform } from "./autoFit";
import { ClipArtBrowser } from "./ClipArtBrowser";
import { QRCodePanel } from "./QRCodePanel";
import { FONT_FAMILIES, type Layer, type ImageLayer, type TextLayer, type ShapeLayer, DRAFT_VERSION } from "./types";

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
  "t-shirt": "tshirt", "t-shirts": "tshirt", "tshirts": "tshirt", "tee": "tshirt", "tees": "tshirt",
  "white-hoodie": "hoodie", "black-hoodie": "hoodie",
  "white-longsleeve": "longsleeve", "black-longsleeve": "longsleeve",
  "long-sleeve": "longsleeve", "long-sleeves": "longsleeve", "longsleeves": "longsleeve",
  "white-mug": "mug", "black-mug": "mug",
  "white-cap": "cap", "black-cap": "cap",
  "white-waterbottle": "waterbottle", "black-waterbottle": "waterbottle",
  "water-bottle": "waterbottle", "water-bottles": "waterbottle", "bottle": "waterbottle",
};

function normalizeStudioProductId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const compact = trimmed.replace(/[-_\s]/g, "");
  return LEGACY_ID_MAP[trimmed] ?? LEGACY_ID_MAP[compact] ?? compact;
}

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
  const activeDrawIdRef = useRef<string | null>(null);
  const urlInitializedRef = useRef(false);

  const store = useDesignStore();
  const {
    selectedProduct, selectedColor, activeFace, mugMode, selectedSize, quantity,
    layers, selectedIds, linkedStoreProduct, showPrintZone, show3D, activeTab, activeTool,
    saveStatus, hasDraft, isMobile, fabricTexture, mobileToolOpen,
    setProduct, setColor, setFace, setMugMode, setSize, setQuantity,
    addLayer, updateLayer, deleteLayer, moveLayer, setLayerVisibility, selectLayer, clearSelection, setLayers, commit,
    undo, redo, setShowPrintZone, setActiveTab, setActiveTool, setShow3D, setLinkedStoreProduct, setSaveStatus, setHasDraft, setMobileToolOpen, setShowProductPicker, setIsMobile,
  } = store;

  const selectedLayerId = selectedIds[0] ?? null;
  const selectedLayer = useMemo(() => layers.find(l => l.id === selectedLayerId) ?? null, [layers, selectedLayerId]);

  const isMug = selectedProduct.category === "mug";
  const isCap = selectedProduct.category === "cap";
  const isWaterBottle = selectedProduct.category === "waterbottle";
  const supportsBack = ["tshirt", "longsleeve", "hoodie", "mug", "cap", "waterbottle"].includes(selectedProduct.category);
  const isZoneTabs = ["tshirt", "longsleeve", "hoodie"].includes(selectedProduct.category);
  const frontMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, "front"),
    [selectedProduct, selectedColor.hex],
  );
  const backMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, "back"),
    [selectedProduct, selectedColor.hex],
  );
  const activeMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, activeFace as Face),
    [selectedProduct, selectedColor.hex, activeFace],
  );

  const apparelZones = useMemo(() => getApparelZones(selectedProduct.category, selectedProduct.printZone, selectedProduct.printZoneBack), [selectedProduct]);
  const activeZoneConfig = useMemo(() => apparelZones.find(z => z.face === activeFace) ?? apparelZones[0], [apparelZones, activeFace]);
  const isFlatZone = activeFace === "left-sleeve" || activeFace === "right-sleeve" || activeFace === "neck-label";

  const pz = useMemo(() => {
    if (isMug) {
      if (mugMode === "wrap") return activeFace === "back" ? MUG_WRAP_BACK_PZ : MUG_PZ;
      return activeFace === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ;
    }
    return getZonePZ(activeFace, selectedProduct);
  }, [isMug, mugMode, activeFace, selectedProduct]);

  const isBlackGarment = isNearBlack(selectedColor.hex);
  const isLightGarment = isLightTint(selectedColor.hex);

  useEffect(() => {
    const onResize = () => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      const maxWidth = mobile ? width - 32 : Math.min(width - 360, 720);
      setCanvasSize(Math.max(320, Math.min(maxWidth, 720)));
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [setIsMobile]);

  // Gallery records never replace canonical geometry. Only explicitly approved
  // ready records may replace the visual preview; failures fall back silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(getApiUrl("/api/mockups"), { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const rows = await response.json() as Array<{
          sourceKitKey?: string | null;
          imageUrl?: string | null;
          masterFileUrl?: string | null;
          ingestionStatus?: string;
        }>;
        if (cancelled) return;
        setRuntimeMockupOverrides(rows.filter((row): row is {
          sourceKitKey: string;
          imageUrl: string;
          masterFileUrl?: string | null;
          ingestionStatus: "ready";
        } => row.ingestionStatus === "ready" && !!row.sourceKitKey && !!row.imageUrl).map(row => ({
          sourceKitKey: row.sourceKitKey,
          imageUrl: row.imageUrl,
          masterFileUrl: row.masterFileUrl,
          ingestionStatus: "ready" as const,
        })));
      } catch {
        // The local v3 resolver remains authoritative when the public API is unavailable.
      }
    })();
    return () => {
      cancelled = true;
      setRuntimeMockupOverrides([]);
    };
  }, []);

  // URL params + draft restore. An explicit product query is authoritative;
  // cloud/local draft restoration must not silently replace it with Hoodie.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const isEdit = sp.get("edit") === "1";
    const explicitUrlProduct = sp.get("product");
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
    const urlProduct = explicitUrlProduct;
    if (urlProduct) {
      const resolved = normalizeStudioProductId(urlProduct);
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
    urlInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDraftPayload(data: any, source: "cloud" | "local") {
    if (!data || data.version !== DRAFT_VERSION) return;
    const explicitUrlProduct = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("product")
      : null;
    if (typeof data.productId === "string" && !explicitUrlProduct) {
      const resolved = normalizeStudioProductId(data.productId);
      const p = PRODUCTS.find(x => x.id === resolved || x.category === resolved);
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

  // Sync URL params only after the initial query has been applied.
  useEffect(() => {
    if (!urlInitializedRef.current) return;
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
    const extension = file.name.toLowerCase().split(".").pop();
    const acceptedExtension = ["jpg", "jpeg", "png", "webp"].includes(extension ?? "");
    if (!file.type.startsWith("image/") && !acceptedExtension) {
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
      try {
        const src = e.target?.result as string;
        if (!src) throw new Error("The selected file was empty.");
        const img = new Image();
        img.src = src;
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("This image could not be decoded.")); });
        try { await img.decode?.(); } catch {}
        const fixed = await autoFixImage(src);
        const layer: ImageLayer = {
          id: uid(), name: file.name.replace(/\.[^.]+$/, "") || "Image",
          type: "image", src: fixed.src, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
          visible: true, locked: false,
          transform: fitImageTransform(img.naturalWidth, img.naturalHeight, { w: pz.w, h: pz.h }, { padding: 0.92, maxScale: 4 }),
          face: activeFace, brightness: fixed.brightness, contrast: fixed.contrast,
        };
        addLayer(layer);
        selectLayer(layer.id);
        setActiveTab("layers");
        toast({ title: "✓ Design placed!", description: "Tap your design to move, resize or adjust it." });
      } catch (error) {
        console.error("Design upload failed", error);
        toast({ title: "Upload failed", description: "This image could not be prepared. Try a JPG, PNG, or WebP under 10MB.", variant: "destructive" });
      }
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
      text: "Your text", fontFamily: FONT_FAMILIES[0].value, fontWeight: 700, fontStyle: "normal", fontSize: 40, color: selectedColor.hex,
      face: activeFace,
    };
    addLayer(layer);
    selectLayer(layer.id);
    setActiveTab("text");
  };

  const handleCanvasAction = (point: { x: number; y: number }) => {
    const id = uid();
    const transform = { x: point.x, y: point.y, scale: 1, rotation: 0, opacity: 1 };
    if (activeTool === "text") {
      const layer: TextLayer = {
        id, name: "Canvas text", type: "text", visible: true, locked: false,
        transform, text: "Your text", fontFamily: FONT_FAMILIES[0].value, fontWeight: 700,
        fontStyle: "normal", fontSize: 40, color: selectedColor.hex, face: activeFace,
      };
      addLayer(layer);
      selectLayer(id);
      setActiveTab("text");
      return;
    }
    if (activeTool === "shape") {
      const layer: ShapeLayer = {
        id, name: "Rectangle", type: "shape", visible: true, locked: false,
        transform, shapeType: "rect", fill: selectedColor.hex,
        strokeColor: selectedColor.hex, strokeWidth: 0, width: 240, height: 160,
        face: activeFace,
      };
      addLayer(layer);
      selectLayer(id);
      setActiveTab("layers");
    }
  };

  const handleDrawStart = (point: { x: number; y: number }) => {
    const id = uid();
    const layer: ShapeLayer = {
      id, name: "Pen stroke", type: "shape", visible: true, locked: false,
      transform: { x: point.x, y: point.y, scale: 1, rotation: 0, opacity: 1 },
      shapeType: "line", fill: selectedColor.hex, strokeColor: selectedColor.hex,
      strokeWidth: 12, width: 1, height: 1, points: [0, 0], face: activeFace,
    };
    activeDrawIdRef.current = id;
    addLayer(layer);
    selectLayer(id);
    setActiveTab("layers");
  };

  const handleDrawMove = (point: { x: number; y: number }) => {
    const id = activeDrawIdRef.current;
    if (!id) return;
    const layer = layers.find((item) => item.id === id);
    if (!layer || layer.type !== "shape") return;
    const localX = point.x - layer.transform.x;
    const localY = point.y - layer.transform.y;
    const existing = layer.points && layer.points.length >= 2 ? layer.points : [0, 0];
    const lastX = existing[existing.length - 2];
    const lastY = existing[existing.length - 1];
    if (Math.hypot(localX - lastX, localY - lastY) < 3) return;
    const nextPoints = [...existing, localX, localY];
    const xs = nextPoints.filter((_, index) => index % 2 === 0);
    const ys = nextPoints.filter((_, index) => index % 2 === 1);
    updateLayer(id, {
      points: nextPoints,
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
    });
  };

  const handleDrawEnd = () => {
    const id = activeDrawIdRef.current;
    if (id) {
      const layer = layers.find((item) => item.id === id);
      if (layer?.type === "shape" && (layer.points?.length ?? 0) < 4) {
        updateLayer(id, { points: [0, 0, 160, 0], width: 160, height: 1 });
      }
      commit();
    }
    activeDrawIdRef.current = null;
  };

  const handlePickColor = (hex: string) => {
    if (!selectedLayer) {
      toast({ title: "Color sampled", description: `${hex} is ready. Select a text or shape layer to apply it.` });
      return;
    }
    if (selectedLayer.type === "text") updateLayer(selectedLayer.id, { color: hex });
    else if (selectedLayer.type === "shape") updateLayer(selectedLayer.id, { fill: hex, strokeColor: hex });
    else updateLayer(selectedLayer.id, { tint: hex });
    commit();
    toast({ title: "Color applied", description: `${hex} applied to ${selectedLayer.name || "the selected layer"}.` });
  };

  const frontLayers = useMemo(() => layers.filter(l => (l.face ?? "front") === "front") as unknown as ComposerLayer[], [layers]);
  const backLayers = useMemo(() => layers.filter(l => (l.face ?? "front") === "back") as unknown as ComposerLayer[], [layers]);

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

    // Use the same canonical transparent cutout as the live SVG preview. The
    // opaque photo is source metadata only and must not create a second silhouette.
    const garmentSrc = frontMockup.cutoutSrc;
    const isColorPhoto = frontMockup.isColorPhoto;
    const frontPZ = isMug ? (mugMode === "wrap" ? MUG_PZ : MUG_SIDE_PZ) : selectedProduct.printZone;
    const backPZ = isMug ? (mugMode === "wrap" ? MUG_WRAP_BACK_PZ : MUG_SIDE_BACK_PZ) : (selectedProduct.printZoneBack ?? selectedProduct.printZone);
    const leftSleeveLayers = layers.filter(l => l.face === "left-sleeve") as unknown as ComposerLayer[];
    const rightSleeveLayers = layers.filter(l => l.face === "right-sleeve") as unknown as ComposerLayer[];
    const neckLabelLayers = layers.filter(l => l.face === "neck-label") as unknown as ComposerLayer[];

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

    // Admin-controlled custom-design pricing. A product launched from the
    // catalog keeps its authoritative linked product/variant price; a blank
    // studio product uses the configured base price plus one customization fee.
    const configuredStudioPrice = isMug
      ? Number(settings.studioMugPrice) + Number(settings.studioMugCustomizationFee)
      : selectedProduct.category === "tshirt"
        ? Number(settings.studioTshirtPrice) + Number(settings.studioTshirtCustomizationFee)
        : isWaterBottle
          ? Number(settings.studioWaterbottlePrice) + Number(settings.studioWaterbottleCustomizationFee)
          : selectedProduct.category === "hoodie"
            ? Number(settings.studioHoodiePrice) + Number(settings.studioHoodieCustomizationFee)
            : selectedProduct.category === "longsleeve"
              ? Number(settings.studioLongsleevePrice) + Number(settings.studioLongsleeveCustomizationFee)
              : isCap
                ? Number(settings.studioCapPrice) + Number(settings.studioCapCustomizationFee)
                : Number(settings.studioTshirtPrice) + Number(settings.studioTshirtCustomizationFee);
    const studioPrice = linkedStoreProduct?.price ?? configuredStudioPrice;
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
    const activeLayers = layers.filter(l => (l.face ?? "front") === activeFace) as unknown as ComposerLayer[];
    if (activeLayers.length === 0) { toast({ title: "Nothing to export", description: "Add a layer first." }); return; }
    const exportMockup = activeFace === "front" ? frontMockup : activeFace === "back" ? backMockup : activeMockup;
    const garmentSrc = exportMockup.cutoutSrc;
    const canvas = document.createElement("canvas");
    const exportPrintZone = isMug
      ? (mugMode === "wrap" ? (activeFace === "back" ? MUG_WRAP_BACK_PZ : MUG_PZ) : (activeFace === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ))
      : activeFace === "front"
        ? selectedProduct.printZone
        : activeFace === "back"
          ? (selectedProduct.printZoneBack ?? selectedProduct.printZone)
          : activeZoneConfig?.pz ?? selectedProduct.printZone;
    await composeGarmentMockup({ canvas, garmentSrc, garmentColor: selectedColor.hex, printZone: exportPrintZone, layers: activeLayers, outSize: 1200, isColorPhoto: exportMockup.isColorPhoto, requiresTint: exportMockup.requiresTint, fabricTexture });
    const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `trynex-${selectedProduct.id}-${activeFace}-design.png`; a.click();
    toast({ title: "PNG exported!", description: "High-res PNG saved to your downloads." });
  };

  const studioColors = useMemo(() => {
    try {
      const raw = isMug ? settings.studioMugColors : selectedProduct.category === "tshirt" ? settings.studioTshirtColors : null;
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length > 0) {
        const canonical = new Map(selectedProduct.colors.map(color => [color.hex.toLowerCase(), color]));
        const filtered = arr
          .map((color: any) => typeof color === "string" ? { name: color, hex: color } : color)
          .filter((color: any) => color?.hex && canonical.has(String(color.hex).toLowerCase()))
          .map((color: any) => canonical.get(String(color.hex).toLowerCase())!);
        if (filtered.length > 0) return filtered;
      }
    } catch {}
    return selectedProduct.colors;
  }, [isMug, settings.studioMugColors, settings.studioTshirtColors, selectedProduct]);

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
            <button onClick={undo} disabled={store.history.length <= 1} className="p-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30 active:scale-95 transition-transform"><Undo2 className="w-3.5 h-3.5" /></button>
            <button onClick={redo} disabled={store.future.length === 0} className="p-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30 active:scale-95 transition-transform"><Redo2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowPrintZone(!showPrintZone)} className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${showPrintZone ? "text-orange-500 bg-orange-50" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}><Eye className="w-3 h-3" /> Print Zone</button>
            {!isFlatZone && <button onClick={() => setShow3D(!show3D)} className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${show3D ? "text-blue-500 bg-blue-50" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}><Package className="w-3 h-3" /> {show3D ? "2D Edit" : "3D Preview"}</button>}
            <motion.button onClick={handleAddToCart} whileTap={{ scale: 0.97 }} className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg shadow-orange-500/20" style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
              <ShoppingCart className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add to Cart</span><span className="sm:hidden">Cart</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 container-wide mx-auto w-full px-2 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <div className="flex-1 min-w-0" ref={containerRef}>
            <ProductSwitcher />
            <div className="mt-3 mb-3">
              <MainToolbar onExport={handleExportPNG} />
              <div className="mb-3 flex items-center gap-2 overflow-x-auto rounded-2xl border border-orange-100 bg-orange-50/70 p-2 md:hidden no-scrollbar">
                <button type="button" onClick={() => setShowProductPicker(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-gray-800 shadow-sm active:scale-95"><Package className="h-3.5 w-3.5 text-orange-500" /> Product</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-3 py-2 text-[11px] font-black text-white shadow-sm active:scale-95"><Upload className="h-3.5 w-3.5" /> Upload</button>
                <button type="button" onClick={addText} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-gray-800 shadow-sm active:scale-95"><Type className="h-3.5 w-3.5 text-blue-500" /> Text</button>
                <button type="button" onClick={() => setMobileToolOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-[11px] font-black text-white shadow-sm active:scale-95"><Wand2 className="h-3.5 w-3.5" /> All tools</button>
              </div>
            </div>
            <input
              id="design-studio-upload"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload design image"
              className="absolute left-0 top-0 h-px w-px opacity-0"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }}
            />

            {isZoneTabs && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
                {apparelZones.map(zone => {
                  const isActive = activeFace === zone.face;
                  const count = layers.filter(l => (l.face ?? "front") === zone.face).length;
                  return (
                    <button key={zone.face} onClick={() => setFace(zone.face)} className="relative shrink-0 px-3.5 py-2 rounded-xl text-xs font-black transition-all active:scale-95" style={{ background: isActive ? "#1C1C1E" : "white", color: isActive ? "white" : "#374151", border: isActive ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb", boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.15)" : "none" }}>
                      {zone.shortLabel}
                      {count > 0 && !isActive && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white bg-orange-500 border-2 border-white">{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {isMug && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 no-scrollbar">
                {(["side1", "side2", "wrap"] as const).map(v => (
                  <button key={v} onClick={() => { setMugMode(v); setFace(v === "side2" ? "back" : "front"); }} className="shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95" style={{ background: mugMode === v ? "#1C1C1E" : "white", color: mugMode === v ? "white" : "#374151", border: mugMode === v ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb", boxShadow: mugMode === v ? "0 4px 12px rgba(0,0,0,0.15)" : "none" }}>
                    {v === "side1" ? "Left Side" : v === "side2" ? "Right Side" : "Wrap"}
                  </button>
                ))}
              </div>
            )}
            {(!isMug && !isZoneTabs && (isCap || isWaterBottle)) && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 no-scrollbar" aria-label="Product view">
                {(["front", "back"] as const).map(view => (
                  <button key={view} onClick={() => setFace(view)} className="shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95" style={{ background: activeFace === view ? "#1C1C1E" : "white", color: activeFace === view ? "white" : "#374151", border: activeFace === view ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb", boxShadow: activeFace === view ? "0 4px 12px rgba(0,0,0,0.15)" : "none" }}>
                    {view === "front" ? "Front" : "Back"}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-orange-500" /><span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Garment Color</span></div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: selectedColor.hex, color: isLightTint(selectedColor.hex) ? "#374151" : "white" }}>{selectedColor.name}</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5 pb-1.5 items-center justify-items-center">
                {studioColors.map((c: any) => {
                  const isSelected = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button key={c.hex} title={c.name} aria-label={`Select ${c.name}`} onClick={() => setColor(c)} className="relative touch-manipulation transition-transform duration-100 hover:scale-110 active:scale-90" style={{ width: 36, height: 36 }}>
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
                      <LazyProductViewer3D product={selectedProduct} garmentColor={selectedColor.hex} front={{ layers: frontLayers, printZone: isMug ? (mugMode === "wrap" ? MUG_PZ : MUG_SIDE_PZ) : selectedProduct.printZone, baseHeight: selectedProduct.baseHeight }} back={supportsBack && backLayers.length > 0 ? { layers: backLayers, printZone: isMug ? (mugMode === "wrap" ? MUG_WRAP_BACK_PZ : MUG_SIDE_BACK_PZ) : (selectedProduct.printZoneBack ?? selectedProduct.printZone), baseHeight: selectedProduct.baseHeight } : undefined} activeFace={activeFace as "front" | "back"} isWrapMode={isMug && mugMode === "wrap"} />
                    </Suspense>
                    <button onClick={() => setShow3D(false)} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold text-white shadow-xl" style={{ background: "rgba(17,24,39,0.85)", backdropFilter: "blur(8px)" }}><Eye className="w-3 h-3 inline mr-1" /> Back to 2D</button>
                  </div>
                )}
                <CanvasArea
                  width={canvasSize}
                  height={canvasSize}
                  printZone={pz}
                  onCanvasAction={handleCanvasAction}
                  onDrawStart={handleDrawStart}
                  onDrawMove={handleDrawMove}
                  onDrawEnd={handleDrawEnd}
                  onPickColor={handlePickColor}
                  mockup={
                    isFlatZone && activeZoneConfig
                      ? <FlatZoneSVG zone={activeZoneConfig} showPrintZone={showPrintZone} mockup={activeMockup} />
                      : <GarmentSVG product={selectedProduct} color={selectedColor.hex} showPrintZone={showPrintZone} face={activeFace} mugMode={isMug ? mugMode : undefined} />
                  }
                />
                {!show3D && !isFlatZone && layers.length === 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-orange-200"
                      style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 10px 28px rgba(232,93,4,0.30)" }}
                      aria-label={`Upload an image for the ${selectedProduct.name}`}
                    >
                      <CloudUpload className="w-5 h-5" />
                      Upload Image
                    </button>
                  </div>
                )}
              </div>
            </div>

            {currentFaceLayers.length > 0 && (
              <div className="px-4 py-2 mt-2 text-[10px] font-semibold text-gray-500 flex items-center gap-2 bg-white border border-gray-200 rounded-xl">
                <Move className="w-3 h-3 text-orange-500" /> Drag · Pinch to scale & rotate · +/− to zoom
              </div>
            )}
          </div>

          {/* ═══════ MOBILE TOOL SHEET BACKDROP ═══════ */}
          {isMobile && mobileToolOpen && (
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" onClick={() => setMobileToolOpen(false)} />
          )}

          {/* ═══════ RIGHT PANEL / MOBILE BOTTOM SHEET ═══════ */}
          <div className={`md:w-[320px] lg:w-[340px] shrink-0 flex flex-col gap-4 transition-all duration-300
            ${isMobile ? `fixed bottom-0 left-0 right-0 z-[70] bg-[#faf9f6] rounded-t-[32px] shadow-2xl overflow-hidden transform ${mobileToolOpen ? 'translate-y-0' : 'translate-y-full'}` : 'relative'}`}
            style={isMobile ? { maxHeight: "85vh" } : {}}>
            
            {isMobile && (
              <div className="flex flex-col items-center pt-3 pb-1 shrink-0 sticky top-0 z-10 bg-[#faf9f6]" onClick={() => setMobileToolOpen(false)}>
                <div className="w-10 h-1 rounded-full bg-gray-300 mb-2" />
                <div className="w-full flex items-center justify-between px-5 pb-2">
                  <span className="text-sm font-black text-gray-800 uppercase tracking-wider">Design Tools</span>
                  <button onClick={() => setMobileToolOpen(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            <div className={`rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col ${isMobile ? 'flex-1 overflow-hidden mx-2 mb-2' : ''}`}>
              <div className="flex p-1.5 gap-1 bg-[#f8f7f5] rounded-t-2xl border-b border-gray-200 shrink-0">
                {[
                  { id: "upload" as const, label: "Upload", icon: Upload },
                  { id: "text" as const, label: "Text", icon: Type },
                  { id: "ai" as const, label: "AI Art", icon: Wand2 },
                  { id: "layers" as const, label: "Layers", icon: LayersIcon },
                  { id: "templates" as const, label: "Templates", icon: Sparkles },
                  { id: "qrcode" as const, label: "QR", icon: Crosshair },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)} className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[9px] font-black transition-all active:scale-90" style={{ background: activeTab === id ? "white" : "transparent", color: activeTab === id ? "#E85D04" : "#9ca3af", boxShadow: activeTab === id ? "0 1px 6px rgba(0,0,0,0.10)" : "none" }}>
                    <Icon className="w-4 h-4" />{label}
                    {id === "layers" && layers.length > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black text-white bg-orange-500 border border-white">{layers.length}</span>}
                  </button>
                ))}
              </div>
              <div className={`p-2 ${isMobile ? 'overflow-y-auto' : ''}`}>
                {activeTab === "upload" && (
                  <div className="p-4 space-y-3">
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white shadow-md active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }}><Upload className="w-4 h-4" /> Upload Image</button>
                    <p className="text-[11px] text-gray-500 text-center">JPG, PNG, or WebP · Max 10MB</p>
                    {selectedLayer?.type === "image" && <ImagePanel />}
                    {!isMug && !isCap && !isWaterBottle && (
                      <div className="pt-3 border-t border-gray-100">
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Garment Size</label>
                        <div className="flex flex-wrap gap-1.5">
                          {SIZE_CHART.map(s => (
                            <button key={s.size} onClick={() => setSize(s.size)} className="px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-90" style={{ background: selectedSize === s.size ? "linear-gradient(135deg,#E85D04,#FB8500)" : "#f3f4f6", color: selectedSize === s.size ? "white" : "#374151", boxShadow: selectedSize === s.size ? "0 2px 8px rgba(232,93,4,0.2)" : "none" }}>{s.size}</button>
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
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all"><ImageIcon className="w-3.5 h-3.5 text-orange-500" /> Image</button>
                      <button onClick={addText} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all"><Type className="w-3.5 h-3.5 text-blue-500" /> Text</button>
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

            <div className={`p-4 rounded-2xl bg-white border border-gray-200 shadow-sm ${isMobile ? 'mx-2 mb-4' : ''}`}>
              <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Export Design</label>
              <div className="flex gap-2">
                <button onClick={handleExportPNG} className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-1"><Download className="w-3 h-3" /> PNG</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ MOBILE FLOATING ACTION BUTTONS ═══════ */}
      {isMobile && (
        <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-3">
          <button
            onClick={() => setMobileToolOpen(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-transform"
            style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 8px 24px rgba(232,93,4,0.4)" }}
          >
            <Wand2 className="w-6 h-6" />
          </button>
        </div>
      )}
      <Footer />
    </div>
  );
}
