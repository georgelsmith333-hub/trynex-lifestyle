/* ═══════════════════════════════════════════════════════════════════════════
   Cloudflare Pages Middleware — Dynamic Rendering for Search Bots
   ───────────────────────────────────────────────────────────────────────────
   WHAT THIS DOES
   ──────────────
   TryNex is a React SPA. When Google/Bing crawl it they first see raw HTML
   with only generic meta tags, then come back days later to render JS.
   This "second wave" delay means product and blog pages can take months to
   rank properly.

   This middleware fixes it: requests from known search bots on dynamic page
   patterns (/product/:slug, /blog/:slug) receive the HTML with the correct
   page-specific title, description, OG tags, and JSON-LD already injected —
   no JavaScript required. Regular visitors always get the normal SPA.

   Google-approved technique: https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering

   FALLBACK
   ────────
   If the API is unreachable or times out (4 s), the middleware falls back to
   serving the unmodified SPA. No user is ever broken.
═══════════════════════════════════════════════════════════════════════════ */

const SITE_URL = "https://trynexshop.com";
const DEFAULT_OG = `${SITE_URL}/opengraph.jpg`;
const API_TIMEOUT_MS = 4000;

const BOT_PATTERNS = [
  "googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider",
  "yandexbot", "facebookexternalhit", "twitterbot", "linkedinbot",
  "whatsapp", "telegrambot", "applebot", "ia_archiver", "petalbot",
  "mj12bot", "semrushbot", "ahrefsbot", "dotbot", "rogerbot",
  "perplexitybot", "claudebot", "gptbot", "chatgpt-user", "ccbot",
  "omgili", "screaming frog",
];

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some((p) => lower.includes(p));
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escJson(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

async function fetchTimeout(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function injectMeta(html: string, opts: {
  title: string; description: string; canonical: string;
  ogType: string; ogImage: string; keywords?: string; jsonLd: unknown[];
}): string {
  const { title, description, canonical, ogType, ogImage, keywords, jsonLd } = opts;
  const t = esc(title); const d = esc(description);
  const c = esc(canonical); const img = esc(ogImage);

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*"/, `$1${d}"`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*"/, `$1${c}"`);
  html = html.replace(/(<meta property="og:type" content=")[^"]*"/, `$1${esc(ogType)}"`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*"/, `$1${t}"`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*"/, `$1${d}"`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*"/, `$1${img}"`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*"/, `$1${c}"`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${t}"`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${d}"`);
  html = html.replace(/(<meta name="twitter:image" content=")[^"]*"/, `$1${img}"`);
  if (keywords) html = html.replace(/(<meta name="keywords" content=")[^"]*"/, `$1${esc(keywords)}"`);

  const blocks = jsonLd
    .map((ld) => `  <script type="application/ld+json" data-cfasync="false">${escJson(ld)}</script>`)
    .join("\n");
  html = html.replace("</head>", `${blocks}\n</head>`);
  return html;
}

function buildProductHtml(html: string, product: any, slug: string): string {
  const name = product.name || "Custom Product";
  const rawDesc = (product.description || "").replace(/<[^>]+>/g, "").trim();
  const desc = rawDesc.slice(0, 160) ||
    `Buy ${name} from TryNex Lifestyle. Premium quality, fast delivery across Bangladesh.`;
  const price = String(product.discountPrice || product.price || "");
  const image = product.imageUrl || DEFAULT_OG;
  const pageUrl = `${SITE_URL}/product/${slug}`;

  return injectMeta(html, {
    title: `${name} | TryNex Lifestyle`,
    description: desc,
    canonical: pageUrl,
    ogType: "product",
    ogImage: image,
    keywords: `${name}, buy ${name} bangladesh, custom ${name.toLowerCase()} bd, trynex lifestyle`,
    jsonLd: [
      {
        "@context": "https://schema.org", "@type": "Product",
        name, description: desc, image, sku: `TN-${product.id}`,
        brand: { "@type": "Brand", name: "TryNex Lifestyle" },
        offers: {
          "@type": "Offer", priceCurrency: "BDT", price,
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: pageUrl, itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: "TryNex Lifestyle" },
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: String(product.rating || "4.9"),
          reviewCount: String(product.reviewCount || "10"),
          bestRating: "5", worstRating: "1",
        },
      },
      {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/products` },
          { "@type": "ListItem", position: 3, name, item: pageUrl },
        ],
      },
    ],
  });
}

function buildBlogHtml(html: string, post: any, slug: string): string {
  const title = post.title || "Blog Post";
  const desc = post.excerpt || `Read "${title}" on TryNex Lifestyle blog.`;
  const image = post.imageUrl || DEFAULT_OG;
  const pageUrl = `${SITE_URL}/blog/${slug}`;
  const author = post.author || "TryNex Lifestyle";
  const tags: string[] = Array.isArray(post.tags) ? post.tags : [];

  return injectMeta(html, {
    title: `${title} | TryNex Lifestyle Blog`,
    description: desc.slice(0, 160),
    canonical: pageUrl,
    ogType: "article",
    ogImage: image,
    keywords: tags.join(", "),
    jsonLd: [
      {
        "@context": "https://schema.org", "@type": "BlogPosting",
        headline: title, description: desc,
        author: { "@type": "Person", name: author },
        datePublished: post.createdAt,
        dateModified: post.updatedAt || post.createdAt,
        publisher: {
          "@type": "Organization", name: "TryNex Lifestyle",
          logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
        },
        image, url: pageUrl,
        articleSection: post.category || "Fashion",
        keywords: tags.join(", "),
        mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
      },
      {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: title, item: pageUrl },
        ],
      },
    ],
  });
}

/* ─── Main entry point ───────────────────────────────────────────── */
export const onRequest: PagesFunction<{ API_URL: string }> = async ({ request, env }) => {
  if (request.method !== "GET") return env.ASSETS.fetch(request);

  const ua = request.headers.get("user-agent") || "";
  const path = new URL(request.url).pathname;

  const productMatch = path.match(/^\/product\/([^/]+)$/);
  const blogMatch = path.match(/^\/blog\/([^/]+)$/);

  // Pass through: not a bot, or not a dynamic page pattern
  if (!isBot(ua) || (!productMatch && !blogMatch)) {
    return env.ASSETS.fetch(request);
  }

  const slug = (productMatch ?? blogMatch)![1];
  const type = productMatch ? "product" : "blog";
  const apiBase = (env.API_URL || "https://trynex-api.onrender.com").replace(/\/$/, "");
  const apiUrl = type === "product"
    ? `${apiBase}/api/products/${encodeURIComponent(slug)}`
    : `${apiBase}/api/blog/${encodeURIComponent(slug)}`;

  // Fetch the SPA base HTML and the API data in parallel
  const [baseRes, apiRes] = await Promise.all([
    env.ASSETS.fetch(new Request(new URL("/", request.url).toString())),
    fetchTimeout(apiUrl),
  ]);

  // Fallback if API failed or returned error
  if (!apiRes || !apiRes.ok) return baseRes;

  let data: any;
  try { data = await apiRes.json(); } catch { return baseRes; }
  if (!data) return baseRes;

  const baseHtml = await baseRes.text();

  try {
    const injected = type === "product"
      ? buildProductHtml(baseHtml, data, slug)
      : buildBlogHtml(baseHtml, data, slug);

    return new Response(injected, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Cache at edge for 10 min so bots don't hammer the API
        "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=60",
        "X-Robots-Tag": "index, follow, max-image-preview:large",
        "X-Prerendered": "1",
      },
    });
  } catch {
    // If meta injection somehow fails, return the unmodified base HTML
    return new Response(baseHtml, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};
