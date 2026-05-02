import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { validateAdminSession } from "../lib/adminSessions";
import { createDb } from "../db";

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const bearer = c.req.header("authorization")?.replace("Bearer ", "");
  const cookieToken = getCookie(c, "admin_token");
  const token = bearer ?? cookieToken;
  if (!token) {
    return c.json({ error: "unauthorized", message: "Admin authentication required" }, 401);
  }

  const db = createDb(c.env.DATABASE_URL);
  const session = await validateAdminSession(db, token);
  if (!session) {
    return c.json({ error: "unauthorized", message: "Admin authentication required" }, 401);
  }

  const isMutation =
    c.req.method === "POST" ||
    c.req.method === "PUT" ||
    c.req.method === "PATCH" ||
    c.req.method === "DELETE";
  const cookieOnly = !bearer && !!cookieToken;

  if (isMutation && cookieOnly) {
    const xrw = c.req.header("x-requested-with");
    if (!xrw || xrw.toLowerCase() !== "xmlhttprequest") {
      return c.json(
        { error: "csrf_blocked", message: "Cross-site request blocked (missing X-Requested-With)" },
        403,
      );
    }

    const allowedRaw = c.env.ALLOWED_ORIGINS;
    if (allowedRaw) {
      const allowed = allowedRaw.split(",").map((o) => o.trim()).filter(Boolean);
      const origin = c.req.header("origin") || "";
      const referer = c.req.header("referer") || "";
      const refererOrigin = referer
        ? (() => { try { return new URL(referer).origin; } catch { return ""; } })()
        : "";
      const ok =
        (origin && allowed.includes(origin)) ||
        (refererOrigin && allowed.includes(refererOrigin));
      if (!ok) {
        return c.json(
          { error: "csrf_blocked", message: "Cross-site request blocked (origin mismatch)" },
          403,
        );
      }
    }
  }

  c.set("adminSession", session);
  await next();
});

export async function validateToken(token: string, databaseUrl: string): Promise<boolean> {
  const db = createDb(databaseUrl);
  return (await validateAdminSession(db, token)) !== null;
}
