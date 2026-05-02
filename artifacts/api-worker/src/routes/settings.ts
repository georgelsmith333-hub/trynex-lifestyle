import { Hono } from "hono";
import { createDb } from "../db";
import { settingsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const SETTINGS_KEYS = [
  "siteName", "tagline", "phone", "email", "address",
  "facebookUrl", "instagramUrl", "youtubeUrl",
  "heroTitle", "heroSubtitle",
  "announcementBar", "freeShippingThreshold",
  "bkashNumber", "nagadNumber", "rocketNumber",
  "whatsappNumber", "shippingCost",
  "googleAnalyticsId", "facebookPixelId", "googleAdsId",
  "siteIcon", "facebookAppId", "googleClientId", "googleSiteVerification",
  "promoBannerTitle", "promoBannerSubtitle", "promoBannerDiscount", "promoBannerCTA", "promoBannerEnabled",
  "removeBgApiKey", "studioTshirtColors", "studioMugColors",
  "studioTshirtPrice", "studioMugPrice",
  "heroImageUrl", "heroGradient", "heroCTAText", "heroCTALink",
  "primaryColor", "announcementColor",
  "trustBadge1Title", "trustBadge1Desc",
  "trustBadge2Title", "trustBadge2Desc",
  "trustBadge3Title", "trustBadge3Desc",
  "trustBadge4Title", "trustBadge4Desc",
  "sectionFeaturedEnabled", "sectionCategoriesEnabled",
  "sectionFlashSaleEnabled", "sectionTestimonialsEnabled",
  "sectionStatsEnabled",
  "categoryTshirtsEnabled", "categoryHoodiesEnabled",
  "categoryCapsEnabled", "categoryMugsEnabled", "categoryCustomEnabled",
  "trustBadge1Icon", "trustBadge2Icon", "trustBadge3Icon", "trustBadge4Icon",
  "announcementEnabled", "announcementAutoHide",
  "flashSaleEnabled", "flashSaleEndTime", "flashSaleMessage",
  "scarcityThreshold", "metaCapiToken",
  "exitIntentPromoEnabled", "exitIntentPromoCode", "exitIntentPromoDiscount",
  "salePageTitle", "salePageSubtitle", "salePageBadge",
  "spinWheelEnabled", "spinWheelDelay", "spinWheelTitle", "spinWheelSubtitle",
  "spinWheelResetAt", "spinWheelCooldownHours",
  "seoDefaultTitle", "seoDefaultDescription", "seoDefaultKeywords", "seoOgImage", "seoTwitterHandle",
  "heroTypewriterPhrases",
  "blogCategories",
];

function fallback(value: string | null | undefined, def: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : def;
}

async function buildSettings(map: Record<string, string | null>, googleClientIdEnv: string) {
  return {
    siteName: fallback(map["siteName"], "TryNex Lifestyle"),
    tagline: fallback(map["tagline"], "You imagine, we craft."),
    phone: map["phone"] ?? "+880 1700-000000",
    email: map["email"] ?? "hello@trynex.com",
    address: map["address"] ?? "Banani, Dhaka-1213, Bangladesh",
    facebookUrl: map["facebookUrl"] ?? "",
    instagramUrl: map["instagramUrl"] ?? "",
    youtubeUrl: map["youtubeUrl"] ?? "",
    heroTitle: map["heroTitle"] ?? "",
    heroSubtitle: map["heroSubtitle"] ?? "",
    announcementBar: map["announcementBar"] ?? "🚚 Free delivery on orders above ৳1,500!",
    freeShippingThreshold: parseFloat(map["freeShippingThreshold"] ?? "1500"),
    bkashNumber: map["bkashNumber"] ?? "01712-345678",
    nagadNumber: map["nagadNumber"] ?? "01811-234567",
    rocketNumber: map["rocketNumber"] ?? "01611-234567",
    whatsappNumber: map["whatsappNumber"] ?? "01700-000000",
    shippingCost: parseFloat(map["shippingCost"] ?? "100"),
    googleAnalyticsId: map["googleAnalyticsId"] ?? "",
    facebookPixelId: map["facebookPixelId"] ?? "",
    googleAdsId: map["googleAdsId"] ?? "",
    siteIcon: map["siteIcon"] ?? "",
    facebookAppId: map["facebookAppId"] ?? "",
    googleClientId: map["googleClientId"] || googleClientIdEnv || "",
    googleSiteVerification: map["googleSiteVerification"] ?? "",
    promoBannerTitle: map["promoBannerTitle"] ?? "",
    promoBannerSubtitle: map["promoBannerSubtitle"] ?? "",
    promoBannerDiscount: map["promoBannerDiscount"] ?? "",
    promoBannerCTA: map["promoBannerCTA"] ?? "",
    promoBannerEnabled: (map["promoBannerEnabled"] ?? "true") !== "false",
    studioTshirtColors: map["studioTshirtColors"] ?? "",
    studioMugColors: map["studioMugColors"] ?? "",
    studioTshirtPrice: parseFloat(map["studioTshirtPrice"] ?? "1099"),
    studioMugPrice: parseFloat(map["studioMugPrice"] ?? "799"),
    heroImageUrl: map["heroImageUrl"] ?? "",
    heroGradient: map["heroGradient"] ?? "",
    heroCTAText: map["heroCTAText"] ?? "Shop Now",
    heroCTALink: map["heroCTALink"] ?? "/shop",
    primaryColor: map["primaryColor"] ?? "#E85D04",
    announcementColor: map["announcementColor"] ?? "#E85D04",
    trustBadge1Title: map["trustBadge1Title"] ?? "100% Secure Payments",
    trustBadge1Desc: map["trustBadge1Desc"] ?? "bKash, Nagad, Rocket & COD",
    trustBadge2Title: map["trustBadge2Title"] ?? "Nationwide Delivery",
    trustBadge2Desc: map["trustBadge2Desc"] ?? "All 64 districts of Bangladesh",
    trustBadge3Title: map["trustBadge3Title"] ?? "Quality Guarantee",
    trustBadge3Desc: map["trustBadge3Desc"] ?? "230-320GSM premium fabric",
    trustBadge4Title: map["trustBadge4Title"] ?? "5,000+ Happy Customers",
    trustBadge4Desc: map["trustBadge4Desc"] ?? "98% satisfaction rate",
    sectionFeaturedEnabled: (map["sectionFeaturedEnabled"] ?? "true") !== "false",
    sectionCategoriesEnabled: (map["sectionCategoriesEnabled"] ?? "true") !== "false",
    sectionFlashSaleEnabled: (map["sectionFlashSaleEnabled"] ?? "true") !== "false",
    sectionTestimonialsEnabled: (map["sectionTestimonialsEnabled"] ?? "true") !== "false",
    sectionStatsEnabled: (map["sectionStatsEnabled"] ?? "true") !== "false",
    categoryTshirtsEnabled: (map["categoryTshirtsEnabled"] ?? "true") !== "false",
    categoryHoodiesEnabled: (map["categoryHoodiesEnabled"] ?? "true") !== "false",
    categoryCapsEnabled: (map["categoryCapsEnabled"] ?? "true") !== "false",
    categoryMugsEnabled: (map["categoryMugsEnabled"] ?? "true") !== "false",
    categoryCustomEnabled: (map["categoryCustomEnabled"] ?? "true") !== "false",
    trustBadge1Icon: map["trustBadge1Icon"] ?? "shield",
    trustBadge2Icon: map["trustBadge2Icon"] ?? "truck",
    trustBadge3Icon: map["trustBadge3Icon"] ?? "award",
    trustBadge4Icon: map["trustBadge4Icon"] ?? "users",
    announcementEnabled: (map["announcementEnabled"] ?? "true") !== "false",
    announcementAutoHide: (map["announcementAutoHide"] ?? "false") === "true",
    flashSaleEnabled: (map["flashSaleEnabled"] ?? "false") !== "false",
    flashSaleEndTime: map["flashSaleEndTime"] ?? "",
    flashSaleMessage: map["flashSaleMessage"] ?? "⚡ FLASH SALE — Limited Stock!",
    scarcityThreshold: parseInt(map["scarcityThreshold"] ?? "5", 10),
    exitIntentPromoEnabled: (map["exitIntentPromoEnabled"] ?? "true") !== "false",
    exitIntentPromoCode: map["exitIntentPromoCode"] ?? "",
    exitIntentPromoDiscount: map["exitIntentPromoDiscount"] ?? "10%",
    salePageTitle: map["salePageTitle"] ?? "Mega Sale — Up to 50% Off!",
    salePageSubtitle: map["salePageSubtitle"] ?? "Bangladesh's best custom apparel at unbeatable prices.",
    salePageBadge: map["salePageBadge"] ?? "LIMITED TIME",
    spinWheelEnabled: (map["spinWheelEnabled"] ?? "true") !== "false",
    spinWheelDelay: parseInt(map["spinWheelDelay"] ?? "4", 10),
    spinWheelTitle: map["spinWheelTitle"] ?? "Spin & Win an Offer!",
    spinWheelSubtitle: map["spinWheelSubtitle"] ?? "One free spin — no purchase needed.",
    spinWheelResetAt: parseInt(map["spinWheelResetAt"] ?? "0", 10),
    spinWheelCooldownHours: parseInt(map["spinWheelCooldownHours"] ?? "24", 10),
    seoDefaultTitle: map["seoDefaultTitle"] ?? "TryNex Lifestyle — Custom Apparel & Gifts in Bangladesh",
    seoDefaultDescription: map["seoDefaultDescription"] ?? "Design and order custom T-shirts, hoodies, mugs, caps, and gift hampers in Bangladesh.",
    seoDefaultKeywords: map["seoDefaultKeywords"] ?? "custom t-shirt bangladesh, personalized mug, gift hamper, custom hoodie, design studio, trynex",
    seoOgImage: map["seoOgImage"] ?? "",
    seoTwitterHandle: map["seoTwitterHandle"] ?? "",
    heroTypewriterPhrases: map["heroTypewriterPhrases"] ?? "",
    metaCapiTokenConfigured: !!(map["metaCapiToken"]?.trim()),
  };
}

app.get("/settings", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string | null> = {};
    for (const row of rows) map[row.key] = row.value;
    return c.json(await buildSettings(map, c.env.GOOGLE_CLIENT_ID || ""));
  } catch (err) {
    console.error("Failed to get settings", err);
    return c.json({ error: "internal_error", message: "Failed to get settings" }, 500);
  }
});

app.get("/admin/studio-settings", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string | null> = {};
    for (const row of rows) map[row.key] = row.value;
    const base = await buildSettings(map, c.env.GOOGLE_CLIENT_ID || "");
    return c.json({ ...base, removeBgApiKeyConfigured: !!(map["removeBgApiKey"]?.trim()) });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get settings" }, 500);
  }
});

app.put("/settings", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const changedKeys = SETTINGS_KEYS.filter((k) => body[k] !== undefined);
    const beforeRows = changedKeys.length > 0 ? await db.select().from(settingsTable) : [];
    const beforeMap: Record<string, string | null> = {};
    for (const row of beforeRows) beforeMap[row.key] = row.value;
    const afterMap: Record<string, string | null> = {};
    for (const key of SETTINGS_KEYS) {
      if (body[key] !== undefined) {
        const value = body[key]?.toString() ?? null;
        if (key === "removeBgApiKey" && !value?.trim()) continue;
        if (key === "metaCapiToken" && !value?.trim()) continue;
        await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value, updatedAt: new Date() },
        });
        afterMap[key] = value;
      }
    }
    if (changedKeys.length > 0) {
      const before: Record<string, string | null> = {};
      for (const k of Object.keys(afterMap)) before[k] = beforeMap[k] ?? null;
      logActivity(db, { action: "update", entity: "setting", entityId: 0, entityName: "Site Settings", before: before as unknown as Record<string, unknown>, after: afterMap as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    }
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string | null> = {};
    for (const row of rows) map[row.key] = row.value;
    return c.json(await buildSettings(map, c.env.GOOGLE_CLIENT_ID || ""));
  } catch (err) {
    console.error("Failed to update settings", err);
    return c.json({ error: "internal_error", message: "Failed to update settings" }, 500);
  }
});

app.get("/admin/designer-settings", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string | null> = {};
    for (const row of rows) map[row.key] = row.value;
    const all = await buildSettings(map, c.env.GOOGLE_CLIENT_ID || "");
    const s = all as Record<string, unknown>;
    return c.json({
      primaryColor: s["primaryColor"] ?? "#E85D04",
      announcementColor: s["announcementColor"] ?? "#E85D04",
      heroImageUrl: s["heroImageUrl"] ?? "",
      heroGradient: s["heroGradient"] ?? "",
      heroCTAText: s["heroCTAText"] ?? "Shop Now",
      heroCTALink: s["heroCTALink"] ?? "/products",
      heroTitle: s["heroTitle"] ?? "",
      heroSubtitle: s["heroSubtitle"] ?? "",
      announcementBar: s["announcementBar"] ?? "",
      promoBannerTitle: s["promoBannerTitle"] ?? "",
      promoBannerSubtitle: s["promoBannerSubtitle"] ?? "",
      promoBannerDiscount: s["promoBannerDiscount"] ?? "",
      promoBannerCTA: s["promoBannerCTA"] ?? "",
      trustBadge1Title: s["trustBadge1Title"] ?? "",
      trustBadge1Desc: s["trustBadge1Desc"] ?? "",
      trustBadge2Title: s["trustBadge2Title"] ?? "",
      trustBadge2Desc: s["trustBadge2Desc"] ?? "",
      trustBadge3Title: s["trustBadge3Title"] ?? "",
      trustBadge3Desc: s["trustBadge3Desc"] ?? "",
      trustBadge4Title: s["trustBadge4Title"] ?? "",
      trustBadge4Desc: s["trustBadge4Desc"] ?? "",
      trustBadge1Icon: s["trustBadge1Icon"] ?? "shield",
      trustBadge2Icon: s["trustBadge2Icon"] ?? "truck",
      trustBadge3Icon: s["trustBadge3Icon"] ?? "award",
      trustBadge4Icon: s["trustBadge4Icon"] ?? "users",
      sectionFeaturedEnabled: s["sectionFeaturedEnabled"] ?? true,
      sectionCategoriesEnabled: s["sectionCategoriesEnabled"] ?? true,
      sectionFlashSaleEnabled: s["sectionFlashSaleEnabled"] ?? true,
      sectionTestimonialsEnabled: s["sectionTestimonialsEnabled"] ?? true,
      sectionStatsEnabled: s["sectionStatsEnabled"] ?? true,
      categoryTshirtsEnabled: s["categoryTshirtsEnabled"] ?? true,
      categoryHoodiesEnabled: s["categoryHoodiesEnabled"] ?? true,
      categoryCapsEnabled: s["categoryCapsEnabled"] ?? true,
      categoryMugsEnabled: s["categoryMugsEnabled"] ?? true,
      categoryCustomEnabled: s["categoryCustomEnabled"] ?? true,
      announcementEnabled: s["announcementEnabled"] ?? true,
      announcementAutoHide: s["announcementAutoHide"] ?? false,
    });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get designer settings" }, 500);
  }
});

app.patch("/admin/designer-settings", requireAdmin, async (c) => {
  const DESIGNER_KEYS = [
    "primaryColor", "announcementColor", "heroImageUrl", "heroGradient", "heroCTAText", "heroCTALink",
    "heroTitle", "heroSubtitle", "announcementBar", "promoBannerTitle", "promoBannerSubtitle",
    "promoBannerDiscount", "promoBannerCTA", "trustBadge1Title", "trustBadge1Desc", "trustBadge1Icon",
    "trustBadge2Title", "trustBadge2Desc", "trustBadge2Icon", "trustBadge3Title", "trustBadge3Desc",
    "trustBadge3Icon", "trustBadge4Title", "trustBadge4Desc", "trustBadge4Icon",
    "sectionFeaturedEnabled", "sectionCategoriesEnabled", "sectionFlashSaleEnabled",
    "sectionTestimonialsEnabled", "sectionStatsEnabled", "categoryTshirtsEnabled",
    "categoryHoodiesEnabled", "categoryCapsEnabled", "categoryMugsEnabled", "categoryCustomEnabled",
    "announcementEnabled", "announcementAutoHide",
  ];
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    for (const key of DESIGNER_KEYS) {
      if (body[key] !== undefined) {
        const value = body[key]?.toString() ?? null;
        await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value, updatedAt: new Date() },
        });
      }
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update designer settings" }, 500);
  }
});

export default app;
