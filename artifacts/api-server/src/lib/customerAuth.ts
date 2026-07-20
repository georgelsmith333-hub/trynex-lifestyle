import jwt from "jsonwebtoken";
import { logger } from "./logger";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("JWT_SECRET environment variable is missing in production! Auth will fail.");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret_not_for_production";

export function verifyCustomerToken(token: string): { id: number; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    if (decoded.role !== "customer") {
      logger.warn("[customerAuth] Token role mismatch — expected 'customer'");
      return null;
    }
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      // Normal expiry — debug level only (not an attack signal).
      logger.debug("[customerAuth] JWT expired");
    } else if (err instanceof jwt.JsonWebTokenError) {
      // Malformed or tampered token — warn so ops can spot unusual patterns.
      logger.warn({ msg: err.message }, "[customerAuth] JWT invalid (possible tampering)");
    } else if (err instanceof jwt.NotBeforeError) {
      logger.warn("[customerAuth] JWT not-yet-valid (clock skew?)");
    } else {
      logger.warn({ err }, "[customerAuth] JWT verification error");
    }
    return null;
  }
}

export function extractCustomerToken(req: { headers: { authorization?: string }; cookies?: Record<string, string> }): string | null {
  return req.headers.authorization?.replace("Bearer ", "") ?? req.cookies?.customer_token ?? null;
}
