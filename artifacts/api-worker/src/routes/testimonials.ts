import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { createDb } from "../db";
import { testimonialsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

function mapTestimonial(t: typeof testimonialsTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    role: t.role,
    location: t.location,
    stars: t.stars,
    body: t.body,
    active: t.active,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt?.toISOString(),
  };
}

app.get("/testimonials", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db
      .select()
      .from(testimonialsTable)
      .where(eq(testimonialsTable.active, true))
      .orderBy(asc(testimonialsTable.sortOrder), asc(testimonialsTable.id));
    return c.json({ testimonials: rows.map(mapTestimonial) });
  } catch (err) {
    console.error("Failed to list testimonials", err);
    return c.json({ error: "internal_error", message: "Failed to list testimonials" }, 500);
  }
});

app.get("/admin/testimonials", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db
      .select()
      .from(testimonialsTable)
      .orderBy(asc(testimonialsTable.sortOrder), asc(testimonialsTable.id));
    return c.json({ testimonials: rows.map(mapTestimonial) });
  } catch (err) {
    console.error("Failed to list all testimonials", err);
    return c.json({ error: "internal_error", message: "Failed to list testimonials" }, 500);
  }
});

app.post("/admin/testimonials", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { name, role, location, stars, body: testimonialBody, active, sortOrder } = body;
    if (!name?.trim() || !testimonialBody?.trim()) {
      return c.json({ error: "validation_error", message: "name and body are required" }, 400);
    }
    const parsedStars = Math.min(5, Math.max(1, Number(stars) || 5));
    const [created] = await db.insert(testimonialsTable).values({
      name: name.trim(),
      role: role?.trim() ?? "",
      location: location?.trim() ?? "",
      stars: parsedStars,
      body: testimonialBody.trim(),
      active: active !== false,
      sortOrder: Number(sortOrder) || 0,
    }).returning();
    return c.json(mapTestimonial(created), 201);
  } catch (err) {
    console.error("Failed to create testimonial", err);
    return c.json({ error: "internal_error", message: "Failed to create testimonial" }, 500);
  }
});

app.patch("/admin/testimonials/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const body = await c.req.json();
    const { name, role, location, stars, body: testimonialBody, active, sortOrder } = body;
    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) setFields.name = name.trim();
    if (role !== undefined) setFields.role = role?.trim() ?? "";
    if (location !== undefined) setFields.location = location?.trim() ?? "";
    if (stars !== undefined) setFields.stars = Math.min(5, Math.max(1, Number(stars) || 5));
    if (testimonialBody !== undefined) setFields.body = testimonialBody.trim();
    if (active !== undefined) setFields.active = active !== false;
    if (sortOrder !== undefined) setFields.sortOrder = Number(sortOrder) || 0;
    const [updated] = await db.update(testimonialsTable)
      .set(setFields)
      .where(eq(testimonialsTable.id, id))
      .returning();
    if (!updated) return c.json({ error: "not_found", message: "Testimonial not found" }, 404);
    return c.json(mapTestimonial(updated));
  } catch (err) {
    console.error("Failed to update testimonial", err);
    return c.json({ error: "internal_error", message: "Failed to update testimonial" }, 500);
  }
});

app.delete("/admin/testimonials/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    await db.delete(testimonialsTable).where(eq(testimonialsTable.id, id));
    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to delete testimonial", err);
    return c.json({ error: "internal_error", message: "Failed to delete testimonial" }, 500);
  }
});

export default app;
