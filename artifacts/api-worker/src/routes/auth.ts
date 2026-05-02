import { Hono } from "hono";
import { eq, and, gt, isNull } from "drizzle-orm";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { createDb } from "../db";
import {
  customersTable,
  customerPasswordResetTokensTable,
  settingsTable,
} from "../schema";
import { hashPasswordArgon2, verifyPasswordAny, sha256Hex, isArgon2Hash } from "../lib/password";
import {
  signCustomerToken,
  verifyCustomerToken,
  extractCustomerToken,
} from "../lib/auth";
import { logActivity } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  path: "/",
  maxAge: 30 * 24 * 60 * 60,
} as const;

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

type CustomerRow = typeof customersTable.$inferSelect;

function mapCustomer(c: CustomerRow) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    avatar: c.avatar,
    verified: c.verified,
    isGuest: c.isGuest,
    createdAt: c.createdAt?.toISOString(),
  };
}

app.post("/auth/register", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { name, email, password, phone } = body;
    if (!name || !email || !password) {
      return c.json({ error: "validation_error", message: "name, email, password are required" }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: "validation_error", message: "Password must be at least 6 characters" }, 400);
    }
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase().trim()));
    if (existing && !existing.isGuest) {
      return c.json({ error: "email_taken", message: "An account with this email already exists" }, 409);
    }
    const passwordHash = await hashPasswordArgon2(password);
    let customer: CustomerRow;
    if (existing?.isGuest) {
      [customer] = await db.update(customersTable).set({
        name: name.trim(),
        passwordHash,
        phone: phone?.trim() ?? existing.phone,
        isGuest: false,
        updatedAt: new Date(),
      }).where(eq(customersTable.id, existing.id)).returning();
    } else {
      [customer] = await db.insert(customersTable).values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() ?? null,
        passwordHash,
        isGuest: false,
        verified: false,
      }).returning();
    }
    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, { ...COOKIE_OPTS, sameSite: c.env.NODE_ENV === "production" ? "None" : "Lax" });
    return c.json({ customer: mapCustomer(customer), token }, 201);
  } catch (err) {
    console.error("Register error", err);
    return c.json({ error: "internal_error", message: "Registration failed" }, 500);
  }
});

app.post("/auth/login", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { email, password } = body;
    if (!email || !password) {
      return c.json({ error: "validation_error", message: "email and password are required" }, 400);
    }
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase().trim()));
    if (!customer || customer.isGuest) {
      return c.json({ error: "invalid_credentials", message: "Invalid email or password" }, 401);
    }
    if (!customer.passwordHash) {
      if (customer.googleId || customer.facebookId) {
        return c.json({ error: "social_only", message: "This account uses social sign-in. Please use Google or Facebook to log in." }, 401);
      }
      return c.json({ error: "invalid_credentials", message: "Invalid email or password" }, 401);
    }

    const salt = c.env.CUSTOMER_SALT || "";
    const valid = await verifyPasswordAny(customer.passwordHash, password, salt);
    if (!valid) {
      return c.json({ error: "invalid_credentials", message: "Invalid email or password" }, 401);
    }

    if (!isArgon2Hash(customer.passwordHash)) {
      const newHash = await hashPasswordArgon2(password);
      await db.update(customersTable).set({ passwordHash: newHash }).where(eq(customersTable.id, customer.id)).catch(() => {});
    }

    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, { ...COOKIE_OPTS, sameSite: c.env.NODE_ENV === "production" ? "None" : "Lax" });
    return c.json({ customer: mapCustomer(customer), token });
  } catch (err) {
    console.error("Login error", err);
    return c.json({ error: "internal_error", message: "Login failed" }, 500);
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
    if (!token) return c.json({ error: "unauthorized", message: "Not authenticated" }, 401);
    const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, payload.id));
    if (!customer) return c.json({ error: "not_found", message: "Account not found" }, 404);
    return c.json({ customer: mapCustomer(customer) });
  } catch (err) {
    console.error("Auth me error", err);
    return c.json({ error: "internal_error", message: "Failed to get account" }, 500);
  }
});

app.put("/auth/me", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const token = extractCustomerToken(c);
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json();
    const { name, phone } = body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name?.trim()) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() ?? null;
    const [customer] = await db.update(customersTable).set(updates).where(eq(customersTable.id, payload.id)).returning();
    if (!customer) return c.json({ error: "not_found" }, 404);
    return c.json({ customer: mapCustomer(customer) });
  } catch (err) {
    console.error("Update profile error", err);
    return c.json({ error: "internal_error", message: "Failed to update profile" }, 500);
  }
});

app.post("/auth/change-password", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const token = extractCustomerToken(c);
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return c.json({ error: "validation_error", message: "currentPassword and newPassword are required" }, 400);
    }
    if (newPassword.length < 6) {
      return c.json({ error: "validation_error", message: "New password must be at least 6 characters" }, 400);
    }
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, payload.id));
    if (!customer?.passwordHash) return c.json({ error: "no_password", message: "Account has no password set" }, 400);
    const salt = c.env.CUSTOMER_SALT || "";
    const valid = await verifyPasswordAny(customer.passwordHash, currentPassword, salt);
    if (!valid) return c.json({ error: "invalid_credentials", message: "Current password is incorrect" }, 400);
    const newHash = await hashPasswordArgon2(newPassword);
    await db.update(customersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(customersTable.id, payload.id));
    return c.json({ success: true });
  } catch (err) {
    console.error("Change password error", err);
    return c.json({ error: "internal_error", message: "Failed to change password" }, 500);
  }
});

app.post("/auth/google", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { credential } = body;
    if (!credential) {
      return c.json({ error: "validation_error", message: "Google credential is required" }, 400);
    }
    const googleClientId = c.env.GOOGLE_CLIENT_ID;
    let googlePayload: any;
    try {
      const { payload } = await jwtVerify(credential, GOOGLE_JWKS, { audience: googleClientId || undefined });
      googlePayload = payload;
    } catch (err) {
      return c.json({ error: "invalid_credential", message: "Invalid Google credential" }, 401);
    }
    const { sub: googleId, email, name, picture } = googlePayload as any;
    if (!googleId || !email) {
      return c.json({ error: "invalid_credential", message: "Missing required Google profile fields" }, 401);
    }
    let customer: CustomerRow | undefined;
    const [byGoogle] = await db.select().from(customersTable).where(eq(customersTable.googleId, googleId));
    if (byGoogle) {
      customer = byGoogle;
    } else {
      const [byEmail] = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase().trim()));
      if (byEmail) {
        if (byEmail.isGuest) {
          [customer] = await db.update(customersTable).set({ googleId, name: byEmail.name || name || email, avatar: byEmail.avatar || picture || null, isGuest: false, updatedAt: new Date() }).where(eq(customersTable.id, byEmail.id)).returning();
        } else {
          [customer] = await db.update(customersTable).set({ googleId, avatar: byEmail.avatar || picture || null, updatedAt: new Date() }).where(eq(customersTable.id, byEmail.id)).returning();
        }
      } else {
        [customer] = await db.insert(customersTable).values({ googleId, email: email.toLowerCase().trim(), name: name || email, avatar: picture || null, verified: true, isGuest: false }).returning();
      }
    }
    if (!customer) throw new Error("Failed to get/create customer");
    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, { ...COOKIE_OPTS, sameSite: c.env.NODE_ENV === "production" ? "None" : "Lax" });
    return c.json({ customer: mapCustomer(customer), token });
  } catch (err) {
    console.error("Google auth error", err);
    return c.json({ error: "internal_error", message: "Google sign-in failed" }, 500);
  }
});

app.post("/auth/facebook", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { accessToken, userId } = body;
    if (!accessToken) {
      return c.json({ error: "validation_error", message: "Facebook access token is required" }, 400);
    }
    const fbRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!fbRes.ok) {
      return c.json({ error: "invalid_token", message: "Invalid Facebook access token" }, 401);
    }
    const fbProfile = (await fbRes.json()) as any;
    const { id: facebookId, name, email, picture } = fbProfile;
    if (!facebookId) {
      return c.json({ error: "invalid_token", message: "Could not retrieve Facebook profile" }, 401);
    }
    const avatarUrl = picture?.data?.url || null;
    let customer: CustomerRow | undefined;
    const [byFb] = await db.select().from(customersTable).where(eq(customersTable.facebookId, facebookId));
    if (byFb) {
      customer = byFb;
    } else if (email) {
      const [byEmail] = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase().trim()));
      if (byEmail) {
        [customer] = await db.update(customersTable).set({ facebookId, avatar: byEmail.avatar || avatarUrl, updatedAt: new Date() }).where(eq(customersTable.id, byEmail.id)).returning();
      }
    }
    if (!customer) {
      const resolvedEmail = email ? email.toLowerCase().trim() : `fb_${facebookId}@placeholder.trynex.com`;
      [customer] = await db.insert(customersTable).values({ facebookId, email: resolvedEmail, name: name || `Facebook User`, avatar: avatarUrl, verified: !!email, isGuest: false }).returning();
    }
    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    setCookie(c, "customer_token", token, { ...COOKIE_OPTS, sameSite: c.env.NODE_ENV === "production" ? "None" : "Lax" });
    return c.json({ customer: mapCustomer(customer), token });
  } catch (err) {
    console.error("Facebook auth error", err);
    return c.json({ error: "internal_error", message: "Facebook sign-in failed" }, 500);
  }
});

app.post("/auth/request-reset", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { email } = body;
    if (!email) return c.json({ error: "validation_error", message: "email is required" }, 400);
    return c.json({ success: true, message: "If this email exists, a reset link has been sent." });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed" }, 500);
  }
});

app.post("/auth/reset-password", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { token, newPassword } = body;
    if (!token || !newPassword) {
      return c.json({ error: "validation_error", message: "token and newPassword are required" }, 400);
    }
    if (newPassword.length < 6) {
      return c.json({ error: "validation_error", message: "Password must be at least 6 characters" }, 400);
    }
    const tokenHash = await sha256Hex(token);
    const now = new Date();
    const [resetToken] = await db.select().from(customerPasswordResetTokensTable).where(
      and(
        eq(customerPasswordResetTokensTable.tokenHash, tokenHash),
        isNull(customerPasswordResetTokensTable.usedAt),
        gt(customerPasswordResetTokensTable.expiresAt, now),
      ),
    );
    if (!resetToken) {
      return c.json({ error: "invalid_token", message: "Invalid or expired reset token" }, 400);
    }
    const newHash = await hashPasswordArgon2(newPassword);
    await db.update(customersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(customersTable.id, resetToken.customerId));
    await db.update(customerPasswordResetTokensTable).set({ usedAt: new Date() }).where(eq(customerPasswordResetTokensTable.id, resetToken.id));
    return c.json({ success: true });
  } catch (err) {
    console.error("Reset password error", err);
    return c.json({ error: "internal_error", message: "Failed to reset password" }, 500);
  }
});

app.post("/auth/guest", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { name, email, phone } = body;
    if (!name || !email) {
      return c.json({ error: "validation_error", message: "name and email are required for guest checkout" }, 400);
    }
    const existingToken = extractCustomerToken(c);
    if (existingToken) {
      const payload = await verifyCustomerToken(existingToken, c.env.JWT_SECRET);
      if (payload) {
        const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, payload.id));
        if (existing) {
          return c.json({ customer: mapCustomer(existing), token: existingToken, isExisting: true });
        }
      }
    }
    const [existingByEmail] = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase().trim()));
    if (existingByEmail && !existingByEmail.isGuest) {
      return c.json({ customer: mapCustomer(existingByEmail), needsLogin: true, message: "An account with this email already exists. Please log in." });
    }
    let customer: CustomerRow;
    if (existingByEmail?.isGuest) {
      [customer] = await db.update(customersTable).set({ name: name.trim(), phone: phone?.trim() ?? null, updatedAt: new Date() }).where(eq(customersTable.id, existingByEmail.id)).returning();
    } else {
      const [lastGuest] = await db.select({ seq: customersTable.guestSequence }).from(customersTable).where(eq(customersTable.isGuest, true)).orderBy(customersTable.guestSequence).limit(1);
      const nextSeq = (lastGuest?.seq ?? 0) + 1;
      [customer] = await db.insert(customersTable).values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() ?? null,
        isGuest: true,
        guestSequence: nextSeq,
      }).returning();
    }
    const token = await signCustomerToken({ id: customer.id, email: customer.email }, c.env.JWT_SECRET);
    return c.json({ customer: mapCustomer(customer), token, isGuest: true });
  } catch (err) {
    console.error("Guest auth error", err);
    return c.json({ error: "internal_error", message: "Failed to create guest session" }, 500);
  }
});

export default app;
