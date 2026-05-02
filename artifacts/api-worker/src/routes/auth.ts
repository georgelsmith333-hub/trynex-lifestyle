import { Hono } from "hono";
import { eq, or, sql } from "drizzle-orm";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { createDb } from "../db";
import { customersTable, customerPasswordResetTokensTable } from "../schema";
import {
  signCustomerToken,
  verifyCustomerToken,
  extractCustomerToken,
} from "../lib/auth";
import {
  hashPasswordArgon2,
  verifyPasswordArgon2,
  sha256Hex,
} from "../lib/password";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "None" as const,
  maxAge: 60 * 60 * 24 * 30,
};

function mapCustomer(c: any) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    avatar: c.avatar,
    verified: c.verified,
    isGuest: c.isGuest,
    hasPassword: !!c.passwordHash,
    hasGoogle: !!c.googleId,
    hasFacebook: !!c.facebookId,
  };
}

let googleJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getGoogleJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!googleJWKS) {
    googleJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  }
  return googleJWKS;
}

async function getOrCreateGuestSequence(db: ReturnType<typeof createDb>): Promise<number> {
  const [result] = await db.execute(sql`SELECT COALESCE(MAX(guest_sequence), 0) + 1 AS next FROM customers WHERE guest_sequence IS NOT NULL`);
  return Number((result as any).next ?? 1);
}

app.post("/auth/register", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { name, email, password, phone } = body;
    if (!name || !email || !password) {
      return c.json({ error: "validation_error", message: "name, email, password required" }, 400);
    }
    if (password.length < 8) return c.json({ error: "validation_error", message: "Password must be at least 8 characters" }, 400);
    const emailLc = email.toLowerCase().trim();
    const existing = await db.select().from(customersTable).where(eq(customersTable.email, emailLc));
    if (existing.length > 0) return c.json({ error: "already_exists", message: "An account with this email already exists" }, 409);
    const passwordHash = await hashPasswordArgon2(password);
    const [customer] = await db.insert(customersTable).values({
      name: name.trim(),
      email: emailLc,
      phone: phone?.trim() || null,
      passwordHash,
      verified: false,
      isGuest: false,
    }).returning();
    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, COOKIE_OPTS);
    return c.json({ customer: mapCustomer(customer), token }, 201);
  } catch (err) {
    console.error("Register failed", err);
    return c.json({ error: "internal_error", message: "Registration failed" }, 500);
  }
});

app.post("/auth/login", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { email, password } = body;
    if (!email || !password) return c.json({ error: "validation_error", message: "email and password required" }, 400);
    const emailLc = email.toLowerCase().trim();
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, emailLc));
    if (!customer) return c.json({ error: "invalid_credentials", message: "Invalid email or password" }, 401);
    if (!customer.passwordHash) return c.json({ error: "no_password", message: "This account uses social login. Please sign in with Google or Facebook." }, 400);

    const valid = await verifyPasswordArgon2(customer.passwordHash, password);
    if (!valid) return c.json({ error: "invalid_credentials", message: "Invalid email or password" }, 401);

    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, COOKIE_OPTS);
    return c.json({ customer: mapCustomer(customer), token });
  } catch (err) {
    console.error("Login failed", err);
    return c.json({ error: "internal_error", message: "Login failed" }, 500);
  }
});

app.post("/auth/guest", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json().catch(() => ({}));
    const { name, phone } = body ?? {};
    const guestSequence = await getOrCreateGuestSequence(db);
    const guestEmail = `guest_${guestSequence}@trynex.guest`;
    const guestName = (name?.trim() ? name.trim() : null) || `Guest ${guestSequence}`;
    const [customer] = await db.insert(customersTable).values({
      name: guestName,
      email: guestEmail,
      phone: phone?.trim() || null,
      isGuest: true,
      guestSequence,
      verified: false,
    }).returning();
    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, COOKIE_OPTS);
    return c.json({ customer: mapCustomer(customer), token }, 201);
  } catch (err) {
    console.error("Guest login failed", err);
    return c.json({ error: "internal_error", message: "Guest login failed" }, 500);
  }
});

app.post("/auth/logout", async (c) => {
  deleteCookie(c, "customer_token", { path: "/" });
  return c.json({ success: true });
});

app.get("/auth/me", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const token = extractCustomerToken(c);
    if (!token) return c.json({ error: "unauthorized", message: "Not logged in" }, 401);
    const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized", message: "Invalid or expired session" }, 401);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, payload.id));
    if (!customer) return c.json({ error: "not_found", message: "Account not found" }, 404);
    return c.json(mapCustomer(customer));
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get profile" }, 500);
  }
});

app.put("/auth/profile", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const token = extractCustomerToken(c);
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json();
    const { name, phone, avatar } = body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (avatar !== undefined) updates.avatar = avatar || null;
    const [customer] = await db.update(customersTable).set(updates).where(eq(customersTable.id, payload.id)).returning();
    return c.json(mapCustomer(customer));
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update profile" }, 500);
  }
});

app.put("/auth/change-password", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const token = extractCustomerToken(c);
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;
    if (!newPassword || newPassword.length < 8) {
      return c.json({ error: "validation_error", message: "New password must be at least 8 characters" }, 400);
    }
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, payload.id));
    if (!customer) return c.json({ error: "not_found" }, 404);
    if (customer.passwordHash) {
      if (!currentPassword) return c.json({ error: "validation_error", message: "Current password is required" }, 400);
      const valid = await verifyPasswordArgon2(customer.passwordHash, currentPassword);
      if (!valid) return c.json({ error: "invalid_credentials", message: "Current password is incorrect" }, 401);
    }
    const passwordHash = await hashPasswordArgon2(newPassword);
    await db.update(customersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(customersTable.id, payload.id));
    return c.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to change password" }, 500);
  }
});

app.post("/auth/request-password-reset", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { email } = body;
    if (!email) return c.json({ success: true });
    const emailLc = email.toLowerCase().trim();
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, emailLc));
    if (!customer) return c.json({ success: true });
    const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(customerPasswordResetTokensTable).values({ customerId: customer.id, tokenHash, expiresAt });
    console.log(`[password-reset] Token for ${email}: ${rawToken}`);
    return c.json({ success: true, message: "If an account with that email exists, a reset link has been sent." });
  } catch (err) {
    return c.json({ success: true });
  }
});

app.post("/auth/reset-password", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { token, newPassword } = body;
    if (!token || !newPassword || newPassword.length < 8) {
      return c.json({ error: "validation_error", message: "token and newPassword (min 8 chars) are required" }, 400);
    }
    const tokenHash = await sha256Hex(token);
    const [resetToken] = await db.select().from(customerPasswordResetTokensTable)
      .where(eq(customerPasswordResetTokensTable.tokenHash, tokenHash));
    if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt) < new Date()) {
      return c.json({ error: "invalid_token", message: "Invalid or expired reset link" }, 400);
    }
    const passwordHash = await hashPasswordArgon2(newPassword);
    await db.update(customersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(customersTable.id, resetToken.customerId));
    await db.update(customerPasswordResetTokensTable).set({ usedAt: new Date() }).where(eq(customerPasswordResetTokensTable.id, resetToken.id));
    return c.json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to reset password" }, 500);
  }
});

app.post("/auth/google", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { credential, clientId } = body;
    if (!credential) return c.json({ error: "validation_error", message: "credential is required" }, 400);

    const googleClientId = clientId || c.env.GOOGLE_CLIENT_ID;
    let googlePayload: { sub: string; email: string; name: string; picture?: string };
    try {
      const { payload } = await jwtVerify(credential, getGoogleJWKS(), {
        audience: googleClientId,
        issuer: ["accounts.google.com", "https://accounts.google.com"],
      });
      googlePayload = {
        sub: payload.sub as string,
        email: (payload.email as string).toLowerCase(),
        name: payload.name as string,
        picture: payload.picture as string | undefined,
      };
    } catch (e) {
      return c.json({ error: "invalid_token", message: "Invalid Google credential" }, 401);
    }

    const { sub: googleId, email, name, picture } = googlePayload;
    let customer: any;
    const [byGoogleId] = await db.select().from(customersTable).where(eq(customersTable.googleId, googleId));
    if (byGoogleId) {
      customer = byGoogleId;
      if (!customer.avatar && picture) {
        await db.update(customersTable).set({ avatar: picture, updatedAt: new Date() }).where(eq(customersTable.id, customer.id));
        customer.avatar = picture;
      }
    } else {
      const [byEmail] = await db.select().from(customersTable).where(eq(customersTable.email, email));
      if (byEmail) {
        await db.update(customersTable).set({ googleId, avatar: byEmail.avatar || picture, updatedAt: new Date() }).where(eq(customersTable.id, byEmail.id));
        customer = { ...byEmail, googleId, avatar: byEmail.avatar || picture };
      } else {
        [customer] = await db.insert(customersTable).values({
          name,
          email,
          googleId,
          avatar: picture,
          verified: true,
          isGuest: false,
        }).returning();
      }
    }
    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, COOKIE_OPTS);
    return c.json({ customer: mapCustomer(customer), token });
  } catch (err) {
    console.error("Google auth failed", err);
    return c.json({ error: "internal_error", message: "Google authentication failed" }, 500);
  }
});

app.post("/auth/facebook", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { accessToken, facebookId, name, email, picture } = body;
    if (!accessToken || !facebookId) return c.json({ error: "validation_error", message: "accessToken and facebookId required" }, 400);

    const verifyRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`);
    if (!verifyRes.ok) return c.json({ error: "invalid_token", message: "Invalid Facebook token" }, 401);
    const fbData: any = await verifyRes.json();
    if (fbData.id !== facebookId) return c.json({ error: "invalid_token", message: "Facebook token ID mismatch" }, 401);

    const fbEmail = fbData.email?.toLowerCase() || email?.toLowerCase() || null;
    const fbName = fbData.name || name || "Facebook User";
    const fbPicture = fbData.picture?.data?.url || picture || null;

    let customer: any;
    const [byFbId] = await db.select().from(customersTable).where(eq(customersTable.facebookId, facebookId));
    if (byFbId) {
      customer = byFbId;
    } else if (fbEmail) {
      const [byEmail] = await db.select().from(customersTable).where(eq(customersTable.email, fbEmail));
      if (byEmail) {
        await db.update(customersTable).set({ facebookId, updatedAt: new Date() }).where(eq(customersTable.id, byEmail.id));
        customer = { ...byEmail, facebookId };
      }
    }

    if (!customer) {
      const guestSeq = await getOrCreateGuestSequence(db);
      const fallbackEmail = fbEmail || `fb_${facebookId}@trynex.facebook`;
      [customer] = await db.insert(customersTable).values({
        name: fbName,
        email: fallbackEmail,
        facebookId,
        avatar: fbPicture,
        verified: !!fbEmail,
        isGuest: false,
        ...(!fbEmail ? { guestSequence: guestSeq } : {}),
      }).returning();
    }

    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, COOKIE_OPTS);
    return c.json({ customer: mapCustomer(customer), token });
  } catch (err) {
    console.error("Facebook auth failed", err);
    return c.json({ error: "internal_error", message: "Facebook authentication failed" }, 500);
  }
});

app.get("/admin/customers", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const { requireAdmin } = await import("../middleware/adminAuth");
    const token = c.req.header("authorization")?.replace("Bearer ", "") || getCookie(c, "admin_token") || "";
    const { validateAdminSession } = await import("../lib/adminSessions");
    const session = await validateAdminSession(db, token);
    if (!session) return c.json({ error: "unauthorized" }, 401);

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const search = c.req.query("search") || "";
    const offset = (page - 1) * limit;

    const { and: drizzleAnd, or: drizzleOr, ilike: drizzleIlike, desc: drizzleDesc, sql: drizzleSql } = await import("drizzle-orm");
    const where = search ? drizzleOr(
      drizzleIlike(customersTable.name, `%${search}%`),
      drizzleIlike(customersTable.email, `%${search}%`),
    ) : undefined;

    const [customers, countResult] = await Promise.all([
      db.select({ id: customersTable.id, name: customersTable.name, email: customersTable.email, phone: customersTable.phone, avatar: customersTable.avatar, verified: customersTable.verified, isGuest: customersTable.isGuest, hasGoogle: drizzleSql<boolean>`CASE WHEN ${customersTable.googleId} IS NOT NULL THEN true ELSE false END`, hasFacebook: drizzleSql<boolean>`CASE WHEN ${customersTable.facebookId} IS NOT NULL THEN true ELSE false END`, createdAt: customersTable.createdAt })
        .from(customersTable)
        .where(where)
        .orderBy(drizzleDesc(customersTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: drizzleSql<number>`count(*)` }).from(customersTable).where(where),
    ]);
    return c.json({ customers, total: Number(countResult[0]?.count ?? 0), page, limit });
  } catch (err) {
    console.error("Failed to list customers", err);
    return c.json({ error: "internal_error", message: "Failed to list customers" }, 500);
  }
});

export default app;
