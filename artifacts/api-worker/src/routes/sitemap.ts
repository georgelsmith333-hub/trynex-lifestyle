import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { createDb } from "../db";
import { productsTable, categoriesTable, blogPostsTable } from "../schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const SITE_URL = "https://trynexshop.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

app.get("/sitemap.xml", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [products, categories] = await Promise.all([
      db.select({
        slug: productsTable.slug,
        updatedAt: productsTable.updatedAt,
        imageUrl: productsTable.imageUrl,
        name: productsTable.name,
      }).from(productsTable).orderBy(desc(productsTable.createdAt)),
      db.select({ slug: categoriesTable.slug, name: categoriesTable.name }).from(categoriesTable),
    ]);

    let blogPosts: { slug: string; updatedAt: Date | null; imageUrl: string | null; title: string }[] = [];
    try {
      blogPosts = await db.select({
        slug: blogPostsTable.slug,
        updatedAt: blogPostsTable.updatedAt,
        imageUrl: blogPostsTable.imageUrl,
        title: blogPostsTable.title,
      }).from(blogPostsTable).where(eq(blogPostsTable.published, true)).orderBy(desc(blogPostsTable.updatedAt));
    } catch { /* ignore */ }

    const today = new Date().toISOString().split("T")[0];

    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/products", priority: "0.9", changefreq: "daily" },
      { loc: "/blog", priority: "0.7", changefreq: "weekly" },
      { loc: "/sale", priority: "0.8", changefreq: "daily" },
      { loc: "/design-studio", priority: "0.7", changefreq: "monthly" },
      { loc: "/about", priority: "0.6", changefreq: "monthly" },
      { loc: "/faq", priority: "0.6", changefreq: "monthly" },
      { loc: "/size-guide", priority: "0.5", changefreq: "monthly" },
      { loc: "/track", priority: "0.6", changefreq: "monthly" },
      { loc: "/shipping-policy", priority: "0.5", changefreq: "monthly" },
      { loc: "/return-policy", priority: "0.5", changefreq: "monthly" },
      { loc: "/privacy-policy", priority: "0.4", changefreq: "monthly" },
      { loc: "/terms-of-service", priority: "0.4", changefreq: "monthly" },
      { loc: "/referral", priority: "0.5", changefreq: "monthly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n`;
    xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n`;

    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}${page.loc}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="en-BD" href="${SITE_URL}${page.loc}"/>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${page.loc}"/>\n`;
      xml += `  </url>\n`;
    }

    for (const cat of categories) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/products?category=${encodeURIComponent(cat.slug)}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    for (const product of products) {
      const lastmod = product.updatedAt ? new Date(product.updatedAt).toISOString().split("T")[0] : today;
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/product/${product.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      if (product.imageUrl) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(product.imageUrl)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(product.name)}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    for (const post of blogPosts) {
      const lastmod = post.updatedAt ? new Date(post.updatedAt).toISOString().split("T")[0] : today;
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/blog/${post.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      if (post.imageUrl) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(post.imageUrl)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(post.title)}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    xml += `\n</urlset>\n`;

    return c.text(xml, 200, {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    });
  } catch (err) {
    console.error("Sitemap generation failed:", err);
    return c.text("Sitemap generation failed", 500);
  }
});

app.get("/robots.txt", (c) => {
  const robotsTxt = [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /checkout",
    "Disallow: /account",
    "Disallow: /login",
    "Disallow: /signup",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
  ].join("\n");
  return c.text(robotsTxt, 200, {
    "Content-Type": "text/plain",
    "Cache-Control": "public, max-age=86400",
  });
});

export default app;
