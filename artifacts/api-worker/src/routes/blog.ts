import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";
import { createDb } from "../db";
import { blogPostsTable, settingsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { validateToken } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const DEFAULT_BLOG_CATEGORIES = ["General", "Fashion", "Tips", "News", "Lifestyle"];
const DEFAULT_TRENDING_THRESHOLD = 100;

const BlogCreateSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  excerpt: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().max(2048).optional().nullable(),
  author: z.string().max(100).optional().nullable(),
  authorBio: z.string().max(1000).optional().nullable(),
  authorAvatarUrl: z.string().url().max(2048).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  readingTimeOverride: z.number().int().positive().optional().nullable(),
  viewCount: z.number().int().min(0).optional(),
});

const BlogUpdateSchema = BlogCreateSchema.partial();

async function getBlogCategories(db: ReturnType<typeof createDb>): Promise<string[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "blogCategories"));
  if (!row?.value) return DEFAULT_BLOG_CATEGORIES;
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BLOG_CATEGORIES;
  } catch {
    return DEFAULT_BLOG_CATEGORIES;
  }
}

async function saveBlogCategories(db: ReturnType<typeof createDb>, categories: string[]): Promise<void> {
  const value = JSON.stringify(categories);
  await db.insert(settingsTable).values({ key: "blogCategories", value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

async function getTrendingThreshold(db: ReturnType<typeof createDb>): Promise<number> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "trendingThreshold"));
  if (!row?.value) return DEFAULT_TRENDING_THRESHOLD;
  const parsed = parseInt(row.value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_TRENDING_THRESHOLD;
}

function calcReadingTime(content: string): number {
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = plainText.split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function mapPost(p: any, trendingThreshold: number = DEFAULT_TRENDING_THRESHOLD) {
  const readingTime = p.readingTimeOverride ?? calcReadingTime(p.content ?? "");
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    content: p.content,
    imageUrl: p.imageUrl,
    author: p.author,
    authorBio: p.authorBio,
    authorAvatarUrl: p.authorAvatarUrl,
    category: p.category ?? "General",
    tags: p.tags ?? [],
    published: p.published ?? false,
    featured: p.featured ?? false,
    readingTime,
    readingTimeOverride: p.readingTimeOverride ?? null,
    viewCount: p.viewCount ?? 0,
    trending: (p.viewCount ?? 0) >= trendingThreshold,
    createdAt: p.createdAt?.toISOString(),
    updatedAt: p.updatedAt?.toISOString(),
  };
}

app.get("/blog/categories", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [categories, countRows] = await Promise.all([
      getBlogCategories(db),
      db.select({ category: blogPostsTable.category, count: sql<number>`count(*)` })
        .from(blogPostsTable)
        .where(eq(blogPostsTable.published, true))
        .groupBy(blogPostsTable.category),
    ]);
    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of countRows) {
      const cat = row.category ?? "General";
      const n = Number(row.count ?? 0);
      counts[cat] = (counts[cat] ?? 0) + n;
      total += n;
    }
    counts["All"] = total;
    return c.json({ categories, counts });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get blog categories" }, 500);
  }
});

app.post("/blog/categories", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) return c.json({ error: "validation_error", message: "Category name is required" }, 400);
    if (name.length > 60) return c.json({ error: "validation_error", message: "Category name must be 60 characters or fewer" }, 400);
    const categories = await getBlogCategories(db);
    if (categories.map((c) => c.toLowerCase()).includes(name.toLowerCase())) {
      return c.json({ error: "conflict", message: "Category already exists" }, 409);
    }
    const updated = [...categories, name];
    await saveBlogCategories(db, updated);
    return c.json({ categories: updated }, 201);
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to add blog category" }, 500);
  }
});

app.delete("/blog/categories/:name", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const name = decodeURIComponent(c.req.param("name") ?? "").trim();
    if (!name) return c.json({ error: "validation_error", message: "Category name is required" }, 400);
    const reassignTo = c.req.query("reassignTo") || null;
    const categories = await getBlogCategories(db);
    const updated = categories.filter((cat) => cat.toLowerCase() !== name.toLowerCase());
    if (updated.length === categories.length) return c.json({ error: "not_found", message: "Category not found" }, 404);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(blogPostsTable).where(sql`LOWER(${blogPostsTable.category}) = LOWER(${name})`);
    const affectedCount = Number(countResult?.count ?? 0);
    if (affectedCount > 0 && reassignTo) {
      const targetExists = categories.some((cat) => cat.toLowerCase() === reassignTo.toLowerCase());
      if (!targetExists) return c.json({ error: "validation_error", message: `Reassign target category "${reassignTo}" does not exist` }, 400);
      await db.update(blogPostsTable).set({ category: reassignTo, updatedAt: new Date() }).where(sql`LOWER(${blogPostsTable.category}) = LOWER(${name})`);
    }
    await saveBlogCategories(db, updated);
    return c.json({ categories: updated, affectedCount });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to delete blog category" }, 500);
  }
});

app.put("/blog/categories", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const rawList = body?.categories;
    if (!Array.isArray(rawList)) return c.json({ error: "validation_error", message: "categories must be an array" }, 400);
    const seen = new Set<string>();
    const categories: string[] = [];
    for (const raw of rawList) {
      const name = String(raw).trim();
      if (!name) continue;
      if (name.length > 60) return c.json({ error: "validation_error", message: `Category name "${name}" must be 60 characters or fewer` }, 400);
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); categories.push(name); }
    }
    if (categories.length === 0) return c.json({ error: "validation_error", message: "categories list cannot be empty" }, 400);
    await saveBlogCategories(db, categories);
    return c.json({ categories });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update blog categories" }, 500);
  }
});

app.get("/blog/settings", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const trendingThreshold = await getTrendingThreshold(db);
    return c.json({ trendingThreshold });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get blog settings" }, 500);
  }
});

app.patch("/blog/settings", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const raw = body?.trendingThreshold;
    if (raw === undefined) return c.json({ error: "validation_error", message: "trendingThreshold is required" }, 400);
    const rawStr = String(raw).trim();
    if (!/^\d+$/.test(rawStr)) return c.json({ error: "validation_error", message: "trendingThreshold must be a non-negative integer" }, 400);
    const value = parseInt(rawStr, 10);
    await db.insert(settingsTable).values({ key: "trendingThreshold", value: String(value) })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(value), updatedAt: new Date() } });
    return c.json({ trendingThreshold: value });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update blog settings" }, 500);
  }
});

app.get("/blog", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const published = c.req.query("published");
    const page = c.req.query("page") || "1";
    const limit = c.req.query("limit") || "12";
    const category = c.req.query("category");
    const sort = c.req.query("sort") || "newest";
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const authHeader = c.req.header("authorization");
    const cookieToken = getCookie(c, "admin_token");
    const token = authHeader?.replace("Bearer ", "") ?? cookieToken;
    const isAdmin = token ? await validateToken(token, c.env.DATABASE_URL) : false;

    const conditions: any[] = [];
    if (!isAdmin || published === "true") conditions.push(eq(blogPostsTable.published, true));
    if (category && category !== "All") conditions.push(eq(blogPostsTable.category, category));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderClause = sort === "views"
      ? [desc(blogPostsTable.viewCount), desc(blogPostsTable.createdAt)]
      : [desc(blogPostsTable.featured), desc(blogPostsTable.createdAt)];

    const [posts, countResult, threshold] = await Promise.all([
      db.select().from(blogPostsTable).where(where).orderBy(...orderClause).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(blogPostsTable).where(where),
      getTrendingThreshold(db),
    ]);

    return c.json({
      posts: posts.map((p) => mapPost(p, threshold)),
      total: Number(countResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list blog posts" }, 500);
  }
});

app.get("/blog/:id", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const idOrSlug = c.req.param("id");
    const numericId = parseInt(idOrSlug, 10);
    let post: any;
    if (!isNaN(numericId)) {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, numericId));
    } else {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, idOrSlug));
    }
    if (!post) return c.json({ error: "not_found", message: "Blog post not found" }, 404);
    db.update(blogPostsTable).set({ viewCount: sql`${blogPostsTable.viewCount} + 1` }).where(eq(blogPostsTable.id, post.id)).execute().catch(() => {});
    const threshold = await getTrendingThreshold(db);
    return c.json(mapPost(post, threshold));
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get blog post" }, 500);
  }
});

app.get("/blog/:id/related", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const idOrSlug = c.req.param("id");
    const numericId = parseInt(idOrSlug, 10);
    let post: any;
    if (!isNaN(numericId)) {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, numericId));
    } else {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, idOrSlug));
    }
    if (!post) return c.json({ posts: [] });

    const LIMIT = 3;
    const sameCat = await db.select().from(blogPostsTable)
      .where(and(eq(blogPostsTable.published, true), eq(blogPostsTable.category, post.category ?? "General")))
      .orderBy(desc(blogPostsTable.createdAt)).limit(LIMIT + 1);
    const sameCatFiltered = sameCat.filter((r) => r.id !== post!.id).slice(0, LIMIT);
    const threshold = await getTrendingThreshold(db);
    if (sameCatFiltered.length >= LIMIT) return c.json({ posts: sameCatFiltered.map((p) => mapPost(p, threshold)) });

    const alreadyIds = new Set([post.id, ...sameCatFiltered.map((r) => r.id)]);
    const postTags: string[] = post.tags ?? [];
    let tagMatches: typeof sameCat = [];
    if (postTags.length > 0) {
      const allPublished = await db.select().from(blogPostsTable).where(eq(blogPostsTable.published, true)).orderBy(desc(blogPostsTable.createdAt)).limit(50);
      tagMatches = allPublished.filter((r) => !alreadyIds.has(r.id) && (r.tags ?? []).some((t: string) => postTags.includes(t))).slice(0, LIMIT - sameCatFiltered.length);
    }
    const combined = [...sameCatFiltered, ...tagMatches].slice(0, LIMIT);
    return c.json({ posts: combined.map((p) => mapPost(p, threshold)) });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get related posts" }, 500);
  }
});

app.post("/blog", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const parsed = BlogCreateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "validation_error", message: parsed.error.errors.map((e) => e.message).join("; ") }, 400);
    const { title, slug, excerpt, content, imageUrl, author, authorBio, authorAvatarUrl, category, tags, published, featured, readingTimeOverride } = parsed.data;
    const [post] = await db.insert(blogPostsTable).values({
      title, slug,
      excerpt: excerpt ?? undefined,
      content,
      imageUrl: imageUrl ?? undefined,
      author: author ?? "TryNex Team",
      authorBio: authorBio ?? undefined,
      authorAvatarUrl: authorAvatarUrl ?? undefined,
      category: category ?? "General",
      tags: tags ?? [],
      published: published ?? false,
      featured: featured ?? false,
      readingTimeOverride: readingTimeOverride ?? undefined,
    }).returning();
    logActivity(db, { action: "create", entity: "blog", entityId: post.id, entityName: post.title, after: post as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    const threshold = await getTrendingThreshold(db);
    return c.json(mapPost(post, threshold), 201);
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to create blog post" }, 500);
  }
});

app.put("/blog/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id)) return c.json({ error: "validation_error", message: "Invalid blog post id" }, 400);
    const body = await c.req.json();
    const parsed = BlogUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "validation_error", message: parsed.error.errors.map((e) => e.message).join("; ") }, 400);
    const { title, slug, excerpt, content, imageUrl, author, authorBio, authorAvatarUrl, category, tags, published, featured, readingTimeOverride, viewCount } = parsed.data;
    const [beforeSnapshot] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (author !== undefined) updateData.author = author;
    if (authorBio !== undefined) updateData.authorBio = authorBio;
    if (authorAvatarUrl !== undefined) updateData.authorAvatarUrl = authorAvatarUrl;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (published !== undefined) updateData.published = published;
    if (featured !== undefined) updateData.featured = featured;
    if (readingTimeOverride !== undefined) updateData.readingTimeOverride = readingTimeOverride ?? null;
    if (viewCount !== undefined) updateData.viewCount = viewCount;
    const [post] = await db.update(blogPostsTable).set(updateData).where(eq(blogPostsTable.id, id)).returning();
    if (!post) return c.json({ error: "not_found", message: "Blog post not found" }, 404);
    logActivity(db, { action: "update", entity: "blog", entityId: id, entityName: post.title, before: (beforeSnapshot ?? null) as unknown as Record<string, unknown>, after: post as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    const threshold = await getTrendingThreshold(db);
    return c.json(mapPost(post, threshold));
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update blog post" }, 500);
  }
});

app.delete("/blog/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const [beforeSnapshot] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
    const [post] = await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id)).returning();
    if (!post) return c.json({ error: "not_found", message: "Blog post not found" }, 404);
    logActivity(db, { action: "delete", entity: "blog", entityId: id, entityName: post.title, before: (beforeSnapshot ?? post) as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.body(null, 204);
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to delete blog post" }, 500);
  }
});

export default app;
